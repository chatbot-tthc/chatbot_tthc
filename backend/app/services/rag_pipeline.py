"""
RAG Pipeline — Optimized
Luồng: Embed → Retrieve (ChromaDB) → Reranker → Fallback Handler → Gemini Pro
Sử dụng Vertex AI với google-genai SDK
"""

import chromadb
import pdfplumber
from pathlib import Path
from sentence_transformers import SentenceTransformer, CrossEncoder
from app.core.config import settings
import math
from google import genai

# Khởi tạo client Vertex AI
client = genai.Client(
    vertexai=True,
    project=settings.GCP_PROJECT,
    location=settings.GCP_LOCATION,
)

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
1. Chỉ trả lời các câu hỏi liên quan đến thủ tục hành chính công. Nếu câu hỏi nằm ngoài phạm vi (thời tiết, tin tức, câu hỏi cá nhân...), từ chối lịch sự.
2. Nếu tài liệu có thủ tục TƯƠNG TỰ hoặc LIÊN QUAN đến câu hỏi → dùng tài liệu đó để trả lời, KHÔNG từ chối. Ví dụ: hỏi "kết hôn cùng hộ khẩu" thì dùng tài liệu "Thủ tục đăng ký kết hôn" để trả lời.
3. Cấu trúc câu trả lời: Tên thủ tục → Hồ sơ cần chuẩn bị → Trình tự thực hiện → Thời hạn giải quyết → Lệ phí (nếu có).
4. Nếu một mục không có trong tài liệu, bỏ qua mục đó — KHÔNG viết "chưa có thông tin".
5. Trả lời bằng tiếng Việt, ngắn gọn, dễ hiểu.
6. KHÔNG yêu cầu người dùng cung cấp "đúng tên thủ tục" — hãy tự suy luận từ ngữ cảnh câu hỏi.

LƯU Ý: Phần "TÀI LIỆU PDF GỐC" là nguồn chính thức nhất."""


def _sigmoid(x: float) -> float:
    return 1 / (1 + math.exp(-x))


def _expand_query(question: str) -> list[str]:
    q = question.strip()
    queries = [q]
    q_lower = q.lower()
    if not any(kw in q_lower for kw in ["thủ tục", "hồ sơ", "giấy tờ", "quy trình"]):
        queries.append(f"thủ tục {q}")
    if "giấy tờ" in q_lower or "hồ sơ" in q_lower or "cần gì" in q_lower:
        queries.append(f"thành phần hồ sơ {q}")
    if "bước" in q_lower or "như thế nào" in q_lower or "quy trình" in q_lower:
        queries.append(f"trình tự thực hiện {q}")
    
    # Ưu tiên cho kết hôn trong nước
    if "kết hôn" in q_lower and "nước ngoài" not in q_lower:
        queries.append("đăng ký kết hôn trong nước")
        queries.append("hồ sơ đăng ký kết hôn")
        queries.append("giấy tờ đăng ký kết hôn")
    
    # Ưu tiên cho hộ chiếu
    if "hộ chiếu" in q_lower or "passport" in q_lower:
        queries.append("thủ tục cấp hộ chiếu")
        queries.append("hồ sơ làm hộ chiếu")
    
    return queries[:5]


class RAGPipeline:
    def __init__(self):
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

    def _retrieve(self, question: str):
        collection = self._get_collection()
        queries = _expand_query(question)
        seen_contents = {}
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
                    if dist < seen_contents[doc][0]:
                        seen_contents[doc] = (dist, meta)
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
        chunks, distances, metadatas = self._retrieve(question)

        if self._check_fallback(distances):
            return {
                "answer": FALLBACK_MESSAGE,
                "is_fallback": True,
                "chunks": [],
                "scores": [],
                "retrieved_chunks": [],
            }

        reranked = self._rerank(question, chunks)
        top_chunks = [c for c, _, _ in reranked]

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

        prompt = self._build_prompt(question, top_chunks, pdf_docs)

        # Gọi Vertex AI bằng client.models.generate_content
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
        )
        answer = response.text

        # Format retrieved_chunks với pdf_content
        retrieved_chunks = []
        for chunk, ce_score, orig_idx in reranked:
            meta = metadatas[orig_idx] if orig_idx < len(metadatas) else {}
            norm_score = round(_sigmoid(ce_score), 3)
            
            # Lấy pdf_content nếu có
            ma = meta.get("ma_thu_tuc", "")
            bo_nganh = meta.get("bo_nganh", "")
            pdf_text = self._extract_pdf_text(ma, bo_nganh) if ma else ""
            
            retrieved_chunks.append({
                "content": chunk[:300] + "..." if len(chunk) > 300 else chunk,
                "document_title": meta.get("ten_thu_tuc", ""),
                "ma_thu_tuc": ma,
                "score": norm_score,
                "pdf_content": pdf_text[:500] + "..." if len(pdf_text) > 500 else pdf_text,
            })

        return {
            "answer": answer,
            "is_fallback": False,
            "chunks": top_chunks,
            "scores": [round(_sigmoid(s), 3) for _, s, _ in reranked],
            "retrieved_chunks": retrieved_chunks,
        }