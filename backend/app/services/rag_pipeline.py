"""
RAG Pipeline — A3
Luồng: Embed → Retrieve (ChromaDB) → Reranker → Fallback Handler → Gemini Pro
"""
import google.generativeai as genai
import chromadb
from sentence_transformers import SentenceTransformer
from app.core.config import settings

# Cấu hình Gemini (chỉ dùng cho LLM sinh câu trả lời)
genai.configure(api_key=settings.GEMINI_API_KEY)

# Model embedding local — load 1 lần khi import module
embedding_model = SentenceTransformer(settings.EMBEDDING_MODEL)


FALLBACK_MESSAGE = (
    "Hiện tại hệ thống chưa tìm thấy thông tin liên quan đến câu hỏi của bạn "
    "trong cơ sở dữ liệu thủ tục hành chính. "
    "Vui lòng liên hệ trực tiếp với cơ quan có thẩm quyền tại TPHCM để được hỗ trợ."
)

SYSTEM_PROMPT = """Bạn là trợ lý ảo hỗ trợ tra cứu thủ tục hành chính công tại TPHCM.
Hãy trả lời câu hỏi của người dùng DỰA HOÀN TOÀN vào các tài liệu được cung cấp.
Nếu tài liệu không đủ thông tin, hãy nói rõ điều đó.
Trả lời bằng tiếng Việt, rõ ràng, có cấu trúc.
Luôn trích dẫn tên thủ tục và số quyết định nếu có."""


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

    def _rerank(self, query: str, chunks: list[str], scores: list[float]) -> list[tuple]:
        """
        Reranker: chọn Top-N chunk liên quan nhất.
        Hiện dùng distance score từ ChromaDB (cosine).
        TODO: Thay bằng cross-encoder model để chính xác hơn.
        """
        combined = list(zip(chunks, scores))
        # Sắp xếp theo score (distance nhỏ = liên quan hơn)
        combined.sort(key=lambda x: x[1])
        return combined[:settings.RERANKER_TOP_N]

    def _check_fallback(self, scores: list[float]) -> bool:
        """Kiểm tra xem kết quả có đủ độ tin cậy không"""
        if not scores:
            return True
        # ChromaDB cosine distance: 0 = giống nhau, 1 = khác nhau
        # Ngưỡng: nếu distance tốt nhất > threshold → fallback
        best_score = min(scores)
        return best_score > (1 - settings.SIMILARITY_THRESHOLD)

    def _build_prompt(self, question: str, chunks: list[str]) -> str:
        """Ghép tài liệu và câu hỏi thành prompt hoàn chỉnh"""
        context = "\n\n---\n\n".join(
            [f"Tài liệu {i+1}:\n{chunk}" for i, chunk in enumerate(chunks)]
        )
        return f"""{SYSTEM_PROMPT}

=== TÀI LIỆU THAM KHẢO ===
{context}

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

        # Bước 3: Rerank
        reranked = self._rerank(question, chunks, distances)
        top_chunks = [c for c, _ in reranked]
        top_scores = [s for _, s in reranked]

        # Bước 4: Build Prompt
        prompt = self._build_prompt(question, top_chunks)

        # Bước 5: Gemini sinh câu trả lời
        response = self.llm.generate_content(prompt)
        answer = response.text

        # Format retrieved_chunks cho response
        retrieved_chunks = []
        for i, (chunk, score) in enumerate(reranked):
            meta = metadatas[i] if i < len(metadatas) else {}
            retrieved_chunks.append({
                "content": chunk[:200] + "..." if len(chunk) > 200 else chunk,
                "document_title": meta.get("title", ""),
                "ma_thu_tuc": meta.get("ma_thu_tuc", ""),
                "score": round(1 - score, 4),
            })

        return {
            "answer": answer,
            "is_fallback": False,
            "chunks": top_chunks,
            "scores": top_scores,
            "retrieved_chunks": retrieved_chunks,
        }
    

    