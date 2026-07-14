FROM python:3.12-slim-bookworm

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Tải sẵn model embedding + reranker NGAY LÚC BUILD, bake vào image.
# Tránh việc container phải tải ~1.1GB qua mạng mỗi lần khởi động (dễ bị treo
# nếu mạng VM chập chờn) — cache HuggingFace nằm trong lớp ghi của container,
# nên mất sạch mỗi khi container bị tạo lại (rebuild/recreate).
RUN python -c "from sentence_transformers import SentenceTransformer, CrossEncoder; \
SentenceTransformer('intfloat/multilingual-e5-base'); \
CrossEncoder('BAAI/bge-reranker-base', max_length=512)"

# Chromium cho Playwright (crawler — module Quản lý Dữ liệu Bộ/Ngành)
RUN playwright install --with-deps chromium

# Copy source
COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
