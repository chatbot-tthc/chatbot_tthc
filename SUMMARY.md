# Chatbot_TTHC — Tóm tắt hệ thống

**Dự án:** Trợ lý ảo AI tra cứu Thủ tục Hành chính công
**Đơn vị:** VNPT TPHCM — Phòng Dữ liệu số
**Thực tập sinh:** Nguyễn Quốc Tường — **Mentor:** Đỗ Quốc Việt
**Thời gian thực tập:** 04/06/2026 → 19/07/2026
**Môi trường triển khai:** Frontend trên Vercel, Backend + Database trên GCP Compute Engine (Docker Compose)

---

## 0. Dòng thời gian theo tuần (dựa trên lịch sử commit thực tế)

| Tuần | Giai đoạn |
|---|---|
| Tuần 1 (04/06 – 10/06) | Khởi tạo project, setup repo, README kiến trúc ban đầu |
| Tuần 2 (11/06 – 17/06) | Dựng khung backend (FastAPI) + frontend (Next.js), kết nối qua proxy |
| Tuần 3 (18/06 – 24/06) | UI redesign toàn diện (sidebar, theme đỏ-vàng, logo, background), thêm trích dẫn nguồn dạng modal có thể bấm xem |
| Tuần 4 (25/06 – 01/07) | Chuyển RAG sang Gemini qua Vertex AI, sửa pipeline embed/retrieve, hiển thị nội dung PDF trong popup, xây Dashboard Hồ Sơ (dữ liệu Phường Lái Thiêu) |
| Tuần 5 (02/07 – 08/07) | Tách Dashboard thành 2 trang riêng (Chatbot AI + Hồ Sơ) với biểu đồ tương tác, xây trình xem PDF bằng PDF.js có highlight |
| Tuần 6 (09/07 – 15/07) | Hoàn thiện highlight PDF theo đúng section/nhiều trang, sửa lỗi Dashboard Chatbot AI (500), xây mới Dashboard Quản lý Bộ/Ngành (bật/tắt, crawl, thêm bộ/ngành mới từ UI) |

*Ghi chú: nhiều commit trong tuần 5-6 chỉ ghi "new" nên không tách chi tiết theo từng ngày được — mốc tuần được suy từ mật độ commit và các milestone có message rõ ràng.*

---

## 1. Các tính năng đã hoàn thành

### 1.1 Chatbot AI tra cứu thủ tục hành chính (RAG)
Giao diện chat cho người dân hỏi đáp về thủ tục hành chính bằng tiếng Việt tự nhiên.

- **RAG Pipeline** (`backend/app/services/rag_pipeline.py`): Rewrite câu hỏi bằng Gemini → mở rộng thành nhiều truy vấn con (multi-query expansion) → embed bằng model local (`intfloat/multilingual-e5-base`) → tìm kiếm ngữ nghĩa trong ChromaDB (top-10) → rerank bằng cross-encoder (`BAAI/bge-reranker-base`, top-3) → phát hiện fallback nếu độ liên quan thấp → dựng prompt kèm nội dung PDF gốc → sinh câu trả lời bằng Gemini (Vertex AI).
- **Action buttons thông minh**: tự phát hiện ý định (nộp hồ sơ / tra cứu tình trạng hồ sơ) từ câu hỏi và câu trả lời, gắn nút dẫn tới Cổng Dịch vụ công quốc gia.
- **Trích dẫn nguồn**: mỗi câu trả lời hiển thị các đoạn tài liệu (chunk) + độ liên quan (%), có thể bấm để xem toàn văn PDF gốc.
- **Lịch sử chat**: lưu theo session (PostgreSQL), khôi phục lại khi tải lại trang (localStorage + session_id).

### 1.2 Trình xem PDF với Highlight tự động (`frontend/app/PdfViewer.tsx`)
Khi người dùng bấm vào 1 nguồn trích dẫn, hệ thống mở PDF gốc của thủ tục và **tự động highlight đúng đoạn văn bản** đã được dùng để trả lời — kể cả khi đoạn đó trải dài qua nhiều trang. Nhận diện tiêu đề mục (viết hoa toàn bộ) để xác định vùng cần highlight, khớp với 7 mục chuẩn: Thành phần hồ sơ, Trình tự thực hiện, Cách thức thực hiện, Căn cứ pháp lý, Yêu cầu/điều kiện, Kết quả xử lý, Cơ quan thực hiện.

### 1.3 Dashboard Chatbot AI — thống kê hiệu suất (`/dashboard`)
- KPI: tổng số phiên chat, tổng câu hỏi, tỷ lệ trả lời thành công/fallback, thời gian phản hồi trung bình.
- Biểu đồ: tỷ lệ thành công/fallback (pie chart), lượng câu hỏi theo ngày 7 ngày gần nhất (line chart), top thủ tục được hỏi nhiều nhất (bar chart).
- Dữ liệu lấy trực tiếp từ PostgreSQL (bảng `chat_sessions`, `chat_messages`) theo thời gian thực.

### 1.4 Dashboard Hồ Sơ — luồng xử lý hồ sơ hành chính (`/dashboard/hoso`)
Thống kê hồ sơ hành chính thực tế theo cơ quan (hiện có dữ liệu mẫu "Phường Lái Thiêu"): tổng hồ sơ, tỷ lệ đúng hạn/trễ hạn, phân bổ theo trạng thái, theo lĩnh vực, top thủ tục nộp nhiều nhất, đúng hạn/trễ hạn theo lĩnh vực. Có sẵn API upload dữ liệu hồ sơ mới (`POST /api/v1/hoso/upload`, hiện đang ẩn trên UI).

### 1.5 Dashboard Quản lý Bộ/Ngành (`/dashboard/bo-nganh`)
- **Bật/tắt nguồn dữ liệu theo bộ/ngành**: tắt 1 bộ khiến RAG ngay lập tức ngừng tìm kiếm trong dữ liệu của bộ đó (không cần restart server).
- **Crawl/cập nhật dữ liệu**: bấm nút "Cập nhật" để crawl lại toàn bộ thủ tục của 1 bộ từ dichvucong.gov.vn, tự động index lại vào ChromaDB, chạy nền không chặn server, theo dõi tiến độ qua trạng thái tự động cập nhật mỗi 5 giây.
- **Thêm bộ/ngành hoàn toàn mới từ UI**: upload file Excel danh sách mã thủ tục (tải từ dichvucong.gov.vn) → hệ thống tự lưu, tạo bản ghi, và crawler tự nhận diện — **không cần sửa code hay chép file thủ công vào server** như trước.
- Đang quản lý 6 bộ/ngành với tổng 2.639 thủ tục: Bộ Công an, Bộ Tài chính, Bộ Tư pháp, Bộ Xây dựng, Bộ Nông nghiệp và Môi trường, Ngân hàng Nhà nước Việt Nam.

---

## 2. Tech Stack và kiến trúc hệ thống

| Layer | Công nghệ |
|---|---|
| LLM | Gemini (`gemini-2.5-flash`) qua Vertex AI |
| Embedding | `intfloat/multilingual-e5-base` (local, sentence-transformers) |
| Reranker | `BAAI/bge-reranker-base` (cross-encoder, local) |
| Vector DB | ChromaDB |
| Backend | FastAPI (Python 3.12), SQLAlchemy 2.0 (async) + asyncpg |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Biểu đồ | Recharts |
| Database | PostgreSQL 16 |
| Crawler | Playwright (Chromium headless) + openpyxl |
| Container | Docker Compose (postgres, chromadb, backend) |
| Migration | Alembic |
| Triển khai | Frontend: Vercel (auto-deploy khi push git) · Backend: GCP Compute Engine VM (Docker, build + restart thủ công) |

**Kiến trúc thư mục:**
```
chatbot-tthc/
├── backend/                 # FastAPI — RAG Pipeline + REST API
│   ├── app/
│   │   ├── api/v1/          # Endpoints: chat, health, stats, hoso, pdf, agencies
│   │   ├── core/            # Config (Settings), Database (SQLAlchemy engine)
│   │   ├── models/          # DB models (SQLAlchemy) + Pydantic schemas
│   │   └── services/        # RAG Pipeline, agency filter cache
│   ├── alembic/              # Database migrations
│   └── pdf_data/              # PDF gốc từng thủ tục (theo bộ/ngành)
├── frontend/                 # Next.js — Giao diện Chat + 3 Dashboard
│   └── app/
│       ├── page.tsx           # Trang chat chính
│       ├── PdfViewer.tsx       # Modal xem PDF + highlight
│       └── dashboard/          # 3 dashboard: chatbot AI, hồ sơ, bộ/ngành
├── scripts/
│   ├── crawler/               # Thu thập dữ liệu TTHC từ dichvucong.gov.vn
│   └── ingestion/              # Pipeline index dữ liệu vào ChromaDB
└── docker-compose.yml
```

**Luồng RAG:**
```
Câu hỏi → Rewrite (Gemini) → Mở rộng truy vấn → Embed (local)
        → Retrieve Top-10 (ChromaDB, lọc theo bộ/ngành đang bật)
        → Score thấp? → Fallback message
        → Rerank (cross-encoder) → Top-3 chunks
        → Ghép PDF gốc → Build Prompt → Gemini → Câu trả lời + nguồn trích dẫn
```

**Luồng crawl dữ liệu mới (module Quản lý Bộ/Ngành):**
```
Excel mã thủ tục → crawl_tthc.py (Playwright, tìm từng mã trên dichvucong.gov.vn)
                 → reorganize + restructure JSON → download PDF gốc
                 → build_index.py (chunk + embed + upsert ChromaDB)
                 → cập nhật số liệu vào bảng agencies (PostgreSQL)
```

---

## 3. Các file quan trọng

### Backend
| File | Chức năng |
|---|---|
| `app/main.py` | Khởi tạo FastAPI app, đăng ký router, cấu hình CORS |
| `app/core/config.py` | Cấu hình toàn hệ thống (đọc từ `.env`): model AI, ChromaDB, PostgreSQL, tham số RAG |
| `app/core/database.py` | SQLAlchemy async engine + session factory |
| `app/models/db_models.py` | Định nghĩa bảng: `users`, `documents`, `agencies`, `chat_sessions`, `chat_messages`, `api_logs` |
| `app/models/schemas.py` | Pydantic schema validate request/response cho toàn bộ API |
| `app/services/rag_pipeline.py` | **Lõi hệ thống** — toàn bộ luồng RAG (embed, retrieve, rerank, fallback, gọi Gemini) |
| `app/services/agency_filter.py` | Cache 30 giây danh sách bộ/ngành đang bật, dùng để lọc ChromaDB mỗi câu hỏi |
| `app/api/v1/chat.py` | `POST /sessions`, `POST /chat` — endpoint chat chính |
| `app/api/v1/stats.py` | `GET /stats` — số liệu cho Dashboard Chatbot AI |
| `app/api/v1/hoso.py` | CRUD + thống kê hồ sơ hành chính theo cơ quan |
| `app/api/v1/agencies.py` | CRUD bộ/ngành: danh sách, thêm mới, bật/tắt, trigger crawl, xem trạng thái |
| `app/api/v1/pdf.py` | Serve file PDF gốc theo `bo_nganh/ma_thu_tuc` |
| `scripts/crawler/crawl_tthc.py` | Crawler Playwright: tìm + trích xuất nội dung thủ tục từ dichvucong.gov.vn theo mã |
| `scripts/ingestion/build_index.py` | Chunk hoá + embed + nạp dữ liệu vào ChromaDB (có resume) |
| `scripts/ingestion/run_crawl_job.py` | Orchestrator chạy chuỗi crawl → build_index → cập nhật Postgres cho nút "Cập nhật" |
| `scripts/ingestion/seed_agencies.py` | Seed dữ liệu bộ/ngành ban đầu từ ChromaDB đã có |

### Frontend
| File | Chức năng |
|---|---|
| `app/page.tsx` | Trang chat chính — giao diện hỏi đáp, lịch sử, action buttons, sidebar |
| `app/PdfViewer.tsx` | Modal hiển thị PDF gốc + logic highlight tự động theo section |
| `app/dashboard/page.tsx` | Dashboard thống kê hiệu suất chatbot (KPI + biểu đồ) |
| `app/dashboard/hoso/page.tsx` | Dashboard luồng xử lý hồ sơ hành chính theo cơ quan |
| `app/dashboard/bo-nganh/page.tsx` | Dashboard quản lý bộ/ngành: bật/tắt, crawl, thêm bộ/ngành mới |
| `app/layout.tsx` | Layout gốc Next.js (font, metadata) |

---

## 4. Những thay đổi đã thực hiện gần đây

**Sửa lỗi Dashboard Chatbot AI báo "Lỗi 500"** — nguyên nhân: một số bản ghi `chat_messages.retrieved_chunks` chứa ký tự NULL (mã Unicode U+0000, có thể do lỗi trích xuất PDF trước đó), khiến PostgreSQL từ chối parse JSONB. Sửa bằng cách lọc bỏ ký tự này trước khi truy vấn (`backend/app/api/v1/stats.py`), không đụng tới dữ liệu gốc.

**Xây dựng tính năng "Thêm bộ/ngành mới" cho Dashboard Quản lý Bộ/Ngành** — trước đây muốn thêm 1 bộ/ngành mới phải sửa code (dict `ALL_EXCELS`) và chép file Excel thủ công vào server. Đã xây:
- Endpoint `POST /api/v1/agencies` nhận mã, tên hiển thị, file Excel — validate và lưu tự động.
- `scripts/crawler/crawl_tthc.py` tự động quét thư mục Excel mới upload, không cần sửa code khi thêm bộ.
- Giao diện modal "Thêm bộ/ngành mới" trên `/dashboard/bo-nganh`.
- Đã kiểm thử thành công với dữ liệu thật (Tòa án nhân dân).

**Phát hiện và sửa lỗi tiềm ẩn trong crawler** — Chromium trong Docker container dễ bị crash do dung lượng bộ nhớ chia sẻ (`/dev/shm`) mặc định chỉ 64MB; đã thêm flag khởi chạy để trình duyệt dùng ổ đĩa thay vì bộ nhớ chia sẻ.

**Đã xác nhận qua kiểm thử thực tế (không phải giả lập):**
- Toàn bộ 3 dashboard hoạt động đúng trên production (Vercel + GCP VM).
- Luồng chat end-to-end (hỏi → RAG → trả lời → trích dẫn nguồn → PDF highlight) hoạt động chính xác.
- Toggle bật/tắt bộ/ngành có tác động ngay lập tức tới kết quả tìm kiếm của RAG.
- Crawl dữ liệu chạy nền đúng cơ chế subprocess, không chặn server.

**Vấn đề đang theo dõi:** IP của VM production từng bị dichvucong.gov.vn chặn tạm thời (WAF) trong quá trình kiểm thử, ảnh hưởng tới thao tác crawl dữ liệu mới (không ảnh hưởng chat/RAG với dữ liệu đã có). Đang chờ chặn tự hết hiệu lực.

---

## 5. Số liệu & tác động thực tế (đo trên production, ngày 15/07/2026)

| Chỉ số | Giá trị |
|---|---|
| Số bộ/ngành đã số hóa dữ liệu | 6 (Bộ Công an, Tài chính, Tư pháp, Xây dựng, Nông nghiệp & Môi trường, Ngân hàng Nhà nước) |
| Tổng số thủ tục hành chính trong hệ thống | 2.639 thủ tục |
| Tổng số phiên chat đã ghi nhận | 308 phiên |
| Tổng số câu hỏi người dùng đã hỏi | 184 câu |
| Tỷ lệ trả lời thành công (không fallback) | 90,8% |
| Thời gian phản hồi trung bình mỗi câu hỏi | 26,8 giây |
| Thời gian onboard 1 bộ/ngành mới | Trước đây: cần sửa code + thao tác thủ công trên server. Hiện tại: chỉ cần 1 file Excel + vài thao tác trên giao diện, không cần lập trình viên can thiệp |

**Giá trị mang lại:**
- Người dân/cán bộ tra cứu thủ tục hành chính bằng ngôn ngữ tự nhiên thay vì phải tự tìm trong văn bản pháp luật, có trích dẫn nguồn PDF gốc rõ ràng để đối chiếu.
- Cán bộ quản lý có thể giám sát hiệu suất chatbot và bật/tắt/cập nhật nguồn dữ liệu theo bộ/ngành mà không cần hỗ trợ kỹ thuật, rút ngắn thời gian mở rộng hệ thống sang bộ/ngành mới.
- Toàn bộ hệ thống chạy trên hạ tầng chi phí thấp (1 VM GCP e2-standard-2 + Vercel free tier), phù hợp quy mô thử nghiệm/nội bộ.
