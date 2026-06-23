"""
RAG Pipeline — Optimized
Luồng: Embed → Retrieve (ChromaDB) → Reranker → Fallback Handler → Gemini Pro
Tối ưu: bỏ multi-query Gemini, dùng simple query expansion, giảm latency ~70%
"""

import google.generativeai as genai
import chromadb
import pdfplumber
from pathlib import Path
from sentence_transformers import SentenceTransformer, CrossEncoder
from app.core.config import settings
import math

genai.configure(api_key=settings.GEMINI_API_KEY)

embedding_model = SentenceTransformer(settings.EMBEDDING_MODEL)
reranker_model = CrossEncoder(settings.RERANKER_MODEL, max_length=512)

PDF_DIR = Path(settings.PDF_DIR)

FALLBACK_MESSAGE = (
    "Hiện tại hệ thống chưa tìm thấy thông tin liên quan đến câu hỏi của bạn "
    "trong cơ sở dữ liệu thủ tục hành chính. "
    "Vui lòng liên hệ trực tiếp với cơ quan có thẩm quyền tại TPHCM để được hỗ trợ, "
    "hoặc tra cứu tại cổng dichvucong.gov.vn."
)

SYSTEM_PROMPT = """Bạn là trợ lý ảo hỗ trợ tra cứu thủ tục hành chính công tại TP.HCM, được phát triển bởi VNPT TPHCM.

NHIỆM VỤ: Trả lời câu hỏi của người dân/cán bộ về thủ tục hành chính dựa HOÀN TOÀN vào tài liệu được cung cấp.

QUY TẮC TRẢ LỜI:
1. Chỉ trả lời các câu hỏi liên quan đến thủ tục hành chính công. Nếu câu hỏi nằm ngoài phạm vi, từ chối lịch sự và hướng dẫn người dùng hỏi về TTHC.
2. Cấu trúc câu trả lời rõ ràng: Tên thủ tục → Hồ sơ cần chuẩn bị → Trình tự thực hiện → Thời hạn giải quyết → Lệ phí (nếu có).
3. Luôn trích dẫn tên thủ tục và số quyết định/thông tư nếu có trong tài liệu.
4. Nếu một mục không có trong tài liệu, bỏ qua mục đó — không cần đề cập.
5. Trả lời bằng tiếng Việt, ngắn gọn, dễ hiểu với người dân.

LƯU Ý: Phần "TÀI LIỆU PDF GỐC" là nguồn chính thức nhất — ưu tiên dùng để xác minh số quyết định, thời hạn, và các chi tiết cụ thể."""


def _sigmoid(x: float) -> float:
    """Normalize cross-encoder score về 0-1"""
    return 1 / (1 + math.exp(-x))


def _expand_query(question: str) -> list[str]:
    """
    Query expansion đơn giản, không dùng API — chỉ thêm prefix/suffix
    để tăng khả năng match với chunk có format 'Thủ tục: ...'
    """
    q = question.strip()
    queries = [q]

    # Thêm prefix "thủ tục" nếu chưa có
    q_lower = q.lower()
    if not any(kw in q_lower for kw in ["thủ tục", "hồ sơ", "giấy tờ", "quy trình"]):
        queries.append(f"thủ tục {q}")

    # Thêm dạng query tìm hồ sơ
    if "giấy tờ" in q_lower or "hồ sơ" in q_lower or "cần gì" in q_lower:
        queries.append(f"thành phần hồ sơ {q}")

    # Thêm dạng query tìm trình tự
    if "bước" in q_lower or "như thế nào" in q_lower or "quy trình" in q_lower:
        queries.append(f"trình tự thực hiện {q}")

    return queries[:3]  # Tối đa 3 queries


class RAGPipeline:
    def __init__(self):
        self.llm = genai.GenerativeModel(settings.GEMINI_MODEL)
        self._chroma_client = None
        self._collection = None

    def _get_collection(self):
        if self._collection is None:
            self._chroma_client = chromadb.HttpClient(
                host=settings.CHROMA_HOST,
                port=settings.CHROMA_PORT,
            )
            self._collection = self._chroma_client.get_or_create_collection(
                name=settings.CHROMA_COLLECTION,
                metadata={"hnsw:space": "cosine"},
            )
        return self._collection

    def _embed_query(self, text: str) -> list[float]:
        return embedding_model.encode(
            f"query: {text}",
            normalize_embeddings=True,
        ).tolist()

    def _retrieve(self, question: str) -> tuple[list, list, list]:
        """
        Retrieve với simple query expansion (không dùng Gemini).
        Merge kết quả từ nhiều queries, dedup theo document content.
        """
        collection = self._get_collection()
        queries = _expand_query(question)

        seen_contents = {}  # content -> (distance, metadata)

        for q in queries:
            q_embedding = self._embed_query(q)
            results = collection.query(
                query_embeddings=[q_embedding],
                n_results=settings.RETRIEVAL_TOP_K,
                include=["documents", "metadatas", "distances"],
            )
            docs = results["documents"][0] if results["documents"] else []
            dists = results["distances"][0] if results["distances"] else []
            metas = results["metadatas"][0] if results["metadatas"] else []

            for doc, dist, meta in zip(docs, dists, metas):
                if doc not in seen_contents:
                    seen_contents[doc] = (dist, meta)
                else:
                    # Giữ kết quả có distance thấp hơn (tương đồng hơn)
                    if dist < seen_contents[doc][0]:
                        seen_contents[doc] = (dist, meta)

        # Sort theo distance tăng dần
        sorted_items = sorted(seen_contents.items(), key=lambda x: x[1][0])
        top = sorted_items[:settings.RETRIEVAL_TOP_K]

        chunks = [item[0] for item in top]
        distances = [item[1][0] for item in top]
        metadatas = [item[1][1] for item in top]

        return chunks, distances, metadatas

    def _rerank(self, query: str, chunks: list[str]) -> list[tuple]:
        if not chunks:
            return []
        pairs = [[query, chunk] for chunk in chunks]
        ce_scores = reranker_model.predict(pairs)
        combined = [
            (chunk, float(score), idx)
            for idx, (chunk, score) in enumerate(zip(chunks, ce_scores))
        ]
        combined.sort(key=lambda x: x[1], reverse=True)
        return combined[:settings.RERANKER_TOP_N]

    def _extract_pdf_text(self, ma_thu_tuc: str, bo_nganh: str) -> str:
        if not ma_thu_tuc or not bo_nganh:
            return ""
        pdf_path = PDF_DIR / bo_nganh / f"{ma_thu_tuc}.pdf"
        if not pdf_path.exists():
            return ""
        try:
            text_parts = []
            with pdfplumber.open(pdf_path) as pdf:
                for page in pdf.pages:
                    text_parts.append(page.extract_text() or "")
            full_text = "\n".join(text_parts).strip()
            return full_text[:settings.PDF_MAX_CHARS]
        except Exception as e:
            print(f"Lỗi đọc PDF {pdf_path}: {e}")
            return ""

    def _check_fallback(self, distances: list[float]) -> bool:
        if not distances:
            return True
        best = min(distances)
        # Ngưỡng thoải hơn: 0.65 thay vì 0.5
        return best > (1 - 0.35)

    def _build_prompt(self, question: str, chunks: list[str], pdf_docs: list[dict]) -> str:
        context = "\n\n---\n\n".join(
            [f"Tài liệu {i+1}:\n{chunk}" for i, chunk in enumerate(chunks)]
        )
        pdf_context = ""
        if pdf_docs:
            pdf_blocks = "\n\n---\n\n".join(
                [f"PDF - {doc['ten_thu_tuc']}:\n{doc['text']}" for doc in pdf_docs]
            )
            pdf_context = f"\n\n=== TÀI LIỆU PDF GỐC ===\n{pdf_blocks}"

        return f"""{SYSTEM_PROMPT}

=== TÀI LIỆU THAM KHẢO ===
{context}{pdf_context}

=== CÂU HỎI ===
{question}

=== TRẢ LỜI ==="""

    async def query(self, question: str) -> dict:
        # Bước 1: Retrieve với query expansion đơn giản
        chunks, distances, metadatas = self._retrieve(question)

        # Bước 2: Fallback check
        if self._check_fallback(distances):
            return {
                "answer": FALLBACK_MESSAGE,
                "is_fallback": True,
                "chunks": [],
                "scores": [],
                "retrieved_chunks": [],
            }

        # Bước 3: Rerank
        reranked = self._rerank(question, chunks)
        top_chunks = [c for c, _, _ in reranked]

        # Bước 4: Lấy PDF nếu có
        pdf_docs = []
        seen_ma = set()
        for _, _, orig_idx in reranked:
            meta = metadatas[orig_idx] if orig_idx < len(metadatas) else {}
            ma = meta.get("ma_thu_tuc", "")
            bo_nganh = meta.get("bo_nganh", "")
            ten = meta.get("ten_thu_tuc", "")
            if ma and ma not in seen_ma:
                seen_ma.add(ma)
                pdf_text = self._extract_pdf_text(ma, bo_nganh)
                if pdf_text:
                    pdf_docs.append({"ten_thu_tuc": ten, "text": pdf_text})

        # Bước 5: Gemini sinh câu trả lời
        prompt = self._build_prompt(question, top_chunks, pdf_docs)
        response = self.llm.generate_content(prompt)
        answer = response.text

        # Format retrieved_chunks với score normalize về 0-1
        retrieved_chunks = []
        for chunk, ce_score, orig_idx in reranked:
            meta = metadatas[orig_idx] if orig_idx < len(metadatas) else {}
            norm_score = round(_sigmoid(ce_score), 3)
            retrieved_chunks.append({
                "content": chunk[:300] + "..." if len(chunk) > 300 else chunk,
                "document_title": meta.get("ten_thu_tuc", ""),
                "ma_thu_tuc": meta.get("ma_thu_tuc", ""),
                "score": norm_score,
            })

        return {
            "answer": answer,
            "is_fallback": False,
            "chunks": top_chunks,
            "scores": [round(_sigmoid(s), 3) for _, s, _ in reranked],
            "retrieved_chunks": retrieved_chunks,
        }