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

# Từ khóa detect intent
_NOP_KW = ["nộp hồ sơ", "nộp đơn", "đăng ký", "xin cấp", "làm thủ tục", "thực hiện thủ tục"]
_TRA_KW = ["tra cứu", "kiểm tra tiến độ", "xem kết quả", "hồ sơ của tôi", "tình trạng hồ sơ"]


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
    if "kết hôn" in q_lower and "nước ngoài" not in q_lower:
        queries.append("đăng ký kết hôn trong nước")
        queries.append("hồ sơ đăng ký kết hôn")
        queries.append("giấy tờ đăng ký kết hôn")
    if "hộ chiếu" in q_lower or "passport" in q_lower:
        queries.append("thủ tục cấp hộ chiếu")
        queries.append("hồ sơ làm hộ chiếu")
    return queries[:5]


def _detect_action_buttons(question: str, answer: str) -> list[dict]:
    text = (question + " " + answer).lower()
    buttons = []
    if any(kw in text for kw in _NOP_KW):
        buttons.append({
            "label": "🗂️ Nộp hồ sơ trực tuyến",
            "url": "https://dichvucong.gov.vn/p/home/dvc-toan-trinh.html",
            "type": "primary"
        })
    if any(kw in text for kw in _TRA_KW):
        buttons.append({
            "label": "🔍 Tra cứu tình trạng hồ sơ",
            "url": "https://dichvucong.gov.vn/p/home/dvc-tra-cuu-ho-so.html",
            "type": "secondary"
        })
    if not buttons:
        buttons.append({
            "label": "🌐 Xem trên Cổng Dịch vụ công",
            "url": "https://dichvucong.gov.vn/",
            "type": "secondary"
        })
    return buttons


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

    async def _rewrite_query(self, question: str) -> str:
        """Dùng Gemini rewrite câu hỏi thành query chuẩn hóa cho retrieval."""
        try:
            prompt = f"""Bạn là chuyên gia về thủ tục hành chính Việt Nam.
Viết lại câu hỏi sau thành một truy vấn tìm kiếm ngắn gọn, rõ ràng về thủ tục hành chính.
Chỉ trả về truy vấn mới, không giải thích, không thêm thông tin.

Ví dụ:
- "làm hộ chiếu cần gì" → "hồ sơ giấy tờ cần chuẩn bị thủ tục cấp hộ chiếu"
- "đăng ký xe máy mua mới" → "thủ tục đăng ký xe mô tô xe máy lần đầu"
- "lệ phí khai sinh" → "mức lệ phí thủ tục đăng ký khai sinh"

Câu hỏi: {question}
Truy vấn:"""
            response = client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
            )
            rewritten = response.text.strip().strip('"').strip("'")
            # Nếu rewrite quá dài hoặc lỗi thì dùng câu gốc
            if len(rewritten) > 200 or len(rewritten) < 3:
                return question
            return rewritten
        except Exception:
            return question  # Fallback về câu gốc nếu lỗi

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
        q_lower = query.lower()
        combined = []
        for idx, (chunk, score) in enumerate(zip(chunks, ce_scores)):
            adjusted = float(score)
            chunk_lower = chunk.lower()
            if ("nước ngoài" in chunk_lower or "yếu tố nước ngoài" in chunk_lower):
                if "nước ngoài" not in q_lower:
                    adjusted -= 2.0
            combined.append((chunk, adjusted, idx))
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
        # Rewrite query để cải thiện retrieval accuracy
        rewritten_question = await self._rewrite_query(question)
        chunks, distances, metadatas = self._retrieve(rewritten_question)

        if self._check_fallback(distances):
            return {
                "answer": FALLBACK_MESSAGE,
                "is_fallback": True,
                "chunks": [],
                "scores": [],
                "retrieved_chunks": [],
                "action_buttons": [],
            }

        reranked = self._rerank(rewritten_question, chunks)
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

        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
        )
        answer = response.text

        retrieved_chunks = []
        for chunk, ce_score, orig_idx in reranked:
            meta = metadatas[orig_idx] if orig_idx < len(metadatas) else {}
            norm_score = round(_sigmoid(ce_score), 3)
            ma = meta.get("ma_thu_tuc", "")
            bo_nganh = meta.get("bo_nganh", "")
            pdf_text = self._extract_pdf_text(ma, bo_nganh) if ma else ""
            retrieved_chunks.append({
                "content": chunk[:300] + "..." if len(chunk) > 300 else chunk,
                "document_title": meta.get("ten_thu_tuc", ""),
                "ma_thu_tuc": ma,
                "bo_nganh": bo_nganh,
                "score": norm_score,
                "pdf_content": pdf_text,
                "section": meta.get("section", ""),
                "section_title": meta.get("section_title", ""),
            })

        action_buttons = _detect_action_buttons(question, answer)

        return {
            "answer": answer,
            "is_fallback": False,
            "chunks": top_chunks,
            "scores": [round(_sigmoid(s), 3) for _, s, _ in reranked],
            "retrieved_chunks": retrieved_chunks,
            "action_buttons": action_buttons,
        }