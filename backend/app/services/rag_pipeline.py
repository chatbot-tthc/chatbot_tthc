"""
RAG Pipeline — A3
Luồng: Embed → Retrieve (ChromaDB) → Reranker → Fallback Handler → Gemini Pro
"""

import google.generativeai as genai
import chromadb
import pdfplumber
from pathlib import Path
from sentence_transformers import SentenceTransformer, CrossEncoder
from app.core.config import settings

# Cấu hình Gemini (chỉ dùng cho LLM sinh câu trả lời)
genai.configure(api_key=settings.GEMINI_API_KEY)

# Model embedding local — load 1 lần khi import module
embedding_model = SentenceTransformer(settings.EMBEDDING_MODEL)

# Model reranker (cross-encoder) — load 1 lần khi import module
reranker_model = CrossEncoder(settings.RERANKER_MODEL, max_length=512)

# Thư mục chứa PDF gốc (mount read-only từ scripts/crawler/data/pdf — A3.4)
PDF_DIR = Path(settings.PDF_DIR)


FALLBACK_MESSAGE = (
    "Hiện tại hệ thống chưa tìm thấy thông tin liên quan đến câu hỏi của bạn "
    "trong cơ sở dữ liệu thủ tục hành chính. "
    "Vui lòng liên hệ trực tiếp với cơ quan có thẩm quyền tại TPHCM để được hỗ trợ."
)

SYSTEM_PROMPT = """Bạn là trợ lý ảo hỗ trợ tra cứu thủ tục hành chính công tại TPHCM.
Hãy trả lời câu hỏi của người dùng DỰA HOÀN TOÀN vào các tài liệu được cung cấp.
Nếu tài liệu không đủ thông tin, hãy nói rõ điều đó.
Trả lời bằng tiếng Việt, rõ ràng, có cấu trúc.
Luôn trích dẫn tên thủ tục và số quyết định (nếu có) khi trả lời.
Phần "TÀI LIỆU PDF GỐC" chứa nội dung đầy đủ, chính thức nhất của thủ tục — ưu tiên dùng phần này để xác minh số quyết định, thời hạn, và các chi tiết cụ thể."""


class RAGPipeline:
    def __init__(self):
        self.llm = genai.GenerativeModel(settings.GEMINI_MODEL)
        self._chroma_client = None
        self._collection = None

    def _get_collection(self):
        """Lazy init ChromaDB connection"""
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
        """Chuyển câu hỏi thành vector bằng model embedding local"""
        return embedding_model.encode(
            f"query: {text}",
            normalize_embeddings=True,
        ).tolist()

    def _retrieve(self, query_embedding: list[float]) -> dict:
        """Tìm kiếm ngữ nghĩa Top-K chunks từ ChromaDB"""
        collection = self._get_collection()
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=settings.RETRIEVAL_TOP_K,
            include=["documents", "metadatas", "distances"],
        )
        return results

    def _rerank(self, query: str, chunks: list[str]) -> list[tuple]:
        """
        Reranker: dùng Cross-Encoder (BAAI/bge-reranker-base) để re-score
        lại các chunk theo độ liên quan thực sự với câu hỏi.
        Trả về list (chunk, ce_score, original_index), sắp xếp giảm dần
        theo ce_score (điểm càng cao = càng liên quan), lấy Top-N.
        """
        if not chunks:
            return []
        pairs = [[query, chunk] for chunk in chunks]
        ce_scores = reranker_model.predict(pairs)
        combined = [
            (chunk, float(score), idx)
            for idx, (chunk, score) in enumerate(zip(chunks, ce_scores))
        ]
        combined.sort(key=lambda x: x[1], reverse=True)
        return combined[: settings.RERANKER_TOP_N]

    def _extract_pdf_text(self, ma_thu_tuc: str, bo_nganh: str) -> str:
        """Đọc nội dung PDF gốc của thủ tục (nếu có), cắt theo PDF_MAX_CHARS."""
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
            return full_text[: settings.PDF_MAX_CHARS]
        except Exception as e:
            print(f"Lỗi đọc PDF {pdf_path}: {e}")
            return ""

    def _check_fallback(self, scores: list[float]) -> bool:
        """Kiểm tra xem kết quả có đủ độ tin cậy không"""
        if not scores:
            return True
        # ChromaDB cosine distance: 0 = giống nhau, 1 = khác nhau
        # Ngưỡng: nếu distance tốt nhất > threshold → fallback
        best_score = min(scores)
        return best_score > (1 - settings.SIMILARITY_THRESHOLD)

    def _build_prompt(
        self, question: str, chunks: list[str], pdf_docs: list[dict]
    ) -> str:
        """Ghép tài liệu (chunk), tài liệu PDF gốc và câu hỏi thành prompt hoàn chỉnh"""
        context = "\n\n---\n\n".join(
            [f"Tài liệu {i+1}:\n{chunk}" for i, chunk in enumerate(chunks)]
        )

        pdf_context = ""
        if pdf_docs:
            pdf_blocks = "\n\n---\n\n".join(
                [f"PDF - {doc['ten_thu_tuc']}:\n{doc['text']}" for doc in pdf_docs]
            )
            pdf_context = f"""

=== TÀI LIỆU PDF GỐC ===
{pdf_blocks}"""

        return f"""{SYSTEM_PROMPT}

=== TÀI LIỆU THAM KHẢO ===
{context}{pdf_context}

=== CÂU HỎI ===
{question}

=== TRẢ LỜI ==="""

    async def query(self, question: str) -> dict:
        """
        Full RAG Pipeline:
        1. Embed câu hỏi
        2. Retrieve Top-K từ ChromaDB
        3. Rerank → Top-N
        4. Fallback check
        5. Gemini sinh câu trả lời
        """
        # Bước 1: Embed
        query_embedding = self._embed_query(question)

        # Bước 2: Retrieve
        results = self._retrieve(query_embedding)
        chunks = results["documents"][0] if results["documents"] else []
        distances = results["distances"][0] if results["distances"] else []
        metadatas = results["metadatas"][0] if results["metadatas"] else []

        # Bước 3+4: Fallback check
        if self._check_fallback(distances):
            return {
                "answer": FALLBACK_MESSAGE,
                "is_fallback": True,
                "chunks": [],
                "scores": [],
                "retrieved_chunks": [],
            }

        # Bước 3: Rerank (Cross-Encoder)
        reranked = self._rerank(question, chunks)
        top_chunks = [c for c, _, _ in reranked]
        top_scores = [s for _, s, _ in reranked]

        # Bước 3b: Lấy nội dung PDF gốc cho các thủ tục liên quan (A3.4)
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

        # Bước 4: Build Prompt
        prompt = self._build_prompt(question, top_chunks, pdf_docs)

        # Bước 5: Gemini sinh câu trả lời
        response = self.llm.generate_content(prompt)
        answer = response.text

        # Format retrieved_chunks cho response
        retrieved_chunks = []
        for chunk, score, orig_idx in reranked:
            meta = metadatas[orig_idx] if orig_idx < len(metadatas) else {}
            retrieved_chunks.append(
                {
                    "content": chunk[:200] + "..." if len(chunk) > 200 else chunk,
                    "document_title": meta.get("ten_thu_tuc", ""),
                    "ma_thu_tuc": meta.get("ma_thu_tuc", ""),
                    "score": round(score, 4),
                }
            )

        return {
            "answer": answer,
            "is_fallback": False,
            "chunks": top_chunks,
            "scores": top_scores,
            "retrieved_chunks": retrieved_chunks,
        }
