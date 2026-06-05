# Chatbot TTHC — Hệ thống Trợ lý ảo AI tra cứu Thủ tục Hành chính công

**Thực tập sinh:** Nguyễn Quốc Tường  
**Mentor:** Đỗ Quốc Việt  
**Đơn vị:** VNPT TPHCM — Phòng Dữ liệu số  
**Thời gian:** 04/06/2026 → 19/07/2026

---

## Kiến trúc hệ thống

```
chatbot-tthc/
├── backend/          # FastAPI — RAG Pipeline + REST API
│   └── app/
│       ├── api/v1/   # Endpoints: /chat, /health
│       ├── core/     # Config, Database
│       ├── models/   # DB models (SQLAlchemy) + Pydantic schemas
│       └── services/ # RAG Pipeline (Embed → Retrieve → Rerank → LLM)
├── frontend/         # Next.js — Giao diện Chat
├── scripts/
│   ├── ingestion/    # Offline Indexing Pipeline
│   └── crawler/      # Thu thập dữ liệu TTHC
├── docker-compose.yml
└── .env.example
```

## Tech Stack

| Layer | Công nghệ |
|---|---|
| LLM | Gemini Pro (Google AI) |
| Embedding | Gemini Embedding API |
| RAG Framework | LangChain |
| Vector DB | ChromaDB |
| Backend | FastAPI (Python 3.12) |
| Frontend | Next.js |
| Database | PostgreSQL 16 |
| Container | Docker Compose |

## Khởi động local

### 1. Cài đặt
```bash
# Copy file môi trường
cp .env.example .env
# Điền GEMINI_API_KEY vào .env
```

### 2. Chạy với Docker
```bash
docker compose up -d
```

### 3. Chạy backend thủ công (development)
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API docs: http://localhost:8000/docs

## RAG Pipeline

```
Câu hỏi → Embed (Gemini) → Retrieve Top-10 (ChromaDB)
         → Score < ngưỡng? → Fallback Handler
         → Reranker → Top-3 chunks
         → Build Prompt → Gemini Pro → Câu trả lời
```
"# chatbot_tthc" 
