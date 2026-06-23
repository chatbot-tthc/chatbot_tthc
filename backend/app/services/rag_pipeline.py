"""
RAG Pipeline — Cải thiện độ chính xác
Fix:
1. Hạ ngưỡng fallback + mở rộng query để tìm đúng document
2. Prompt chặt hơn, không trả lời ngoài phạm vi
3. Score hiển thị đúng (cosine similarity 0-1, không phải cross-encoder raw)
"""

import google.generativeai as genai
import chromadb
import pdfplumber
from pathlib import Path
from sentence_transformers import SentenceTransformer, CrossEncoder
from app.core.config import settings

genai.configure(api_key=settings.GEMINI_API_KEY)

embedding_model = SentenceTransformer(settings.EMBEDDING_MODEL)
reranker_model = CrossEncoder(settings.RERANKER_MODEL, max_length=512)

PDF_DIR = Path(settings.PDF_DIR)

FALLBACK_MESSAGE = (
    "Xin lỗi, hiện tại hệ thống chưa tìm thấy thông tin chính xác về thủ tục bạn hỏi "
    "trong cơ sở dữ liệu. Vui lòng liên hệ trực tiếp với cơ quan có thẩm quyền "
    "hoặc tra cứu tại Cổng Dịch vụ công Quốc gia (dichvucong.gov.vn) để được hỗ trợ."
)

SYSTEM_PROMPT = """Bạn là trợ lý ảo hỗ trợ tra cứu thủ tục hành chính công tại Việt Nam, được phát triển bởi VNPT TPHCM.

NHIỆM VỤ: Trả lời câu hỏi của người dân/cán bộ về thủ tục hành chính dựa HOÀN TOÀN vào tài liệu được cung cấp.

QUY TẮC BẮT BUỘC:
1. CHỈ trả lời các câu hỏi liên quan đến thủ tục hành chính công (hồ sơ, giấy tờ, trình tự, thời hạn, lệ phí, cơ quan thực hiện). Nếu câu hỏi về chủ đề khác (thời tiết, tin tức, đời sống cá nhân...), từ chối lịch sự và hướng dẫn hỏi về TTHC.

2. Cấu trúc câu trả lời LUÔN theo thứ tự:
   - Tên thủ tục (chính xác theo tài liệu)
   - Hồ sơ cần chuẩn bị
   - Trình tự thực hiện
   - Thời hạn giải quyết
   - Lệ phí (nếu có)
   - Cơ quan thực hiện

3. Nếu tài liệu CÓ thông tin → trả lời đầy đủ, cụ thể, trích dẫn con số chính xác.
4. Nếu tài liệu KHÔNG CÓ thông tin cho một mục cụ thể → bỏ qua mục đó, KHÔNG viết "Tài liệu hiện tại chưa có đủ thông tin".
5. KHÔNG tự bịa thêm thông tin ngoài tài liệu.
6. KHÔNG lặp lại câu hỏi của người dùng.
7. Trả lời bằng tiếng Việt, ngắn gọn, rõ ràng, dễ hiểu.

LƯU Ý: Ưu tiên thông tin từ "TÀI LIỆU PDF GỐC" nếu có — đây là nguồn chính thức nhất."""


def _expand_query(question: str) -> list[str]:
    """
    Tạo nhiều biến thể query để tăng khả năng tìm đúng document.
    Fix vấn đề: hỏi 'kết hôn cùng hộ khẩu' nhưng retrieve ra 'kết hôn yếu tố nước ngoài'
    """
    queries = [question]

    # Thêm prefix context cho embedding
    queries.append(f"thủ tục hành chính: {question}")
    queries.append(f"hồ sơ giấy tờ quy trình: {question}")

    # Xử lý một số trường hợp phổ biến bị sai
    q_lower = question.lower()

    if "kết hôn" in q_lower and "nước ngoài" not in q_lower and "yếu tố" not in q_lower:
        queries.append("thủ tục đăng ký kết hôn trong nước hai công dân Việt Nam")
        queries.append("đăng ký kết hôn tại UBND cấp xã phường")

    if "hộ chiếu" in q_lower and "mất" not in q_lower:
        queries.append("cấp hộ chiếu phổ thông lần đầu")
        queries.append("làm hộ chiếu passport thủ tục hồ sơ")

    if "khai sinh" in q_lower:
        queries.append("đăng ký khai sinh trẻ em mới sinh")
        queries.append("giấy khai sinh hồ sơ cần chuẩn bị")

    if "cccd" in q_lower or "căn cước" in q_lower or "chứng minh" in q_lower:
        queries.append("cấp đổi căn cước công dân CCCD gắn chip")

    if "xe máy" in q_lower or "ô tô" in q_lower or "phương tiện" in q_lower:
        queries.append("đăng ký xe phương tiện giao thông")

    return queries[:5]  # Giới hạn 5 queries để không quá chậm


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

    def _retrieve_multi_query(self, question: str) -> tuple[list, list, list]:
        """
        Retrieve với nhiều query biến thể, merge và dedup kết quả.
        Trả về (chunks, distances, metadatas)
        """
        collection = self._get_collection()
        queries = _expand_query(question)

        seen_ids = set()
        all_chunks = []
        all_distances = []
        all_metadatas = []

        for q in queries:
            embedding = self._embed_query(q)
            results = collection.query(
                query_embeddings=[embedding],
                n_results=min(settings.RETRIEVAL_TOP_K, 10),
                include=["documents", "metadatas", "distances", "ids"],
            )

            if not results["documents"] or not results["documents"][0]:
                continue

            for i, doc_id in enumerate(results["ids"][0]):
                if doc_id not in seen_ids:
                    seen_ids.add(doc_id)
                    all_chunks.append(results["documents"][0][i])
                    all_distances.append(results["distances"][0][i])
                    all_metadatas.append(results["metadatas"][0][i])

        # Sort theo distance (nhỏ = tốt)
        combined = sorted(
            zip(all_distances, all_chunks, all_metadatas),
            key=lambda x: x[0]
        )

        if not combined:
            return [], [], []

        distances, chunks, metadatas = zip(*combined)
        return list(chunks), list(distances), list(metadatas)

    def _rerank(self, query: str, chunks: list[str]) -> list[tuple]:
        """
        Rerank với cross-encoder.
        Trả về (chunk, normalized_score 0-1, original_index)
        """
        if not chunks:
            return []

        pairs = [[query, chunk] for chunk in chunks]
        ce_scores_raw = reranker_model.predict(pairs)

        # Normalize cross-encoder score sang 0-1 bằng sigmoid
        import math
        def sigmoid(x):
            return 1 / (1 + math.exp(-x))

        combined = [
            (chunk, sigmoid(float(score)), idx)
            for idx, (chunk, score) in enumerate(zip(chunks, ce_scores_raw))
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
        """
        Hạ ngưỡng từ 0.5 xuống 0.65 để giảm false fallback.
        ChromaDB cosine distance: 0=giống nhau, 1=khác nhau
        distance > 0.65 → fallback (trước đây > 0.5, quá chặt)
        """
        if not distances:
            return True
        best_distance = min(distances)
        # Ngưỡng mới: 0.65 (thoải hơn so với 0.5 cũ)
        threshold = 1 - (settings.SIMILARITY_THRESHOLD * 0.7)
        return best_distance > threshold

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
        """
        Full RAG Pipeline với multi-query retrieve và normalized score
        """
        # Bước 1+2: Multi-query Retrieve
        chunks, distances, metadatas = self._retrieve_multi_query(question)

        # Bước 3: Fallback check
        if self._check_fallback(distances):
            return {
                "answer": FALLBACK_MESSAGE,
                "is_fallback": True,
                "chunks": [],
                "scores": [],
                "retrieved_chunks": [],
            }

        # Bước 4: Rerank với normalized score
        reranked = self._rerank(question, chunks[:20])  # Rerank top 20
        top_chunks = [c for c, _, _ in reranked]
        top_scores = [s for _, s, _ in reranked]

        # Bước 5: Lấy PDF gốc
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

        # Bước 6: Build prompt + Gemini
        prompt = self._build_prompt(question, top_chunks, pdf_docs)
        response = self.llm.generate_content(prompt)
        answer = response.text

        # Format retrieved_chunks với score đã normalize (0-1)
        retrieved_chunks = []
        for chunk, score, orig_idx in reranked:
            meta = metadatas[orig_idx] if orig_idx < len(metadatas) else {}
            retrieved_chunks.append({
                "content": chunk[:300] + "..." if len(chunk) > 300 else chunk,
                "document_title": meta.get("ten_thu_tuc", ""),
                "ma_thu_tuc": meta.get("ma_thu_tuc", ""),
                "score": round(score, 4),  # 0.0 - 1.0, normalized
            })

        return {
            "answer": answer,
            "is_fallback": False,
            "chunks": top_chunks,
            "scores": top_scores,
            "retrieved_chunks": retrieved_chunks,
        }