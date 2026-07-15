FROM python:3.12-slim-bookworm

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Tải sẵn model embedding + reranker NGAY LÚC BUILD, bake vào image.
# Tránh việc container phải tải ~1.1GB qua mạng mỗi lần khởi động (dễ bị treo
# nếu mạng VM chập chờn) — cache HuggingFace nằm trong lớp ghi của container,
# nên mất sạch mỗi khi container bị tạo lại (rebuild/recreate).
# HF_HUB_DISABLE_XET=1: tắt hẳn backend tải mới "Xet" của HuggingFace — đây là
# nguyên nhân thực sự gây treo (đã xác minh: domain CDN của Xet vẫn kết nối
# nhanh bình thường, nhưng bản thân giao thức Xet bị treo khi tải file thật).
# Tắt Xet sẽ ép dùng đường tải truyền thống, kết hợp hf_transfer (đa luồng,
# nhanh hơn tải 1 luồng mặc định) — đã test thực tế tải xong model trong ~36s
# khi tắt Xet. HF_HUB_DOWNLOAD_TIMEOUT vẫn giữ làm lưới an toàn — nếu mạng
# treo giữa chừng, lỗi sau 60s thay vì đứng mãi, vòng lặp bên dưới tự thử lại
# tối đa 5 lần.
ENV HF_HUB_DISABLE_XET=1
ENV HF_HUB_ENABLE_HF_TRANSFER=1
ENV HF_HUB_DOWNLOAD_TIMEOUT=60
RUN success=0; \
    for i in 1 2 3 4 5; do \
      python -c "from sentence_transformers import SentenceTransformer, CrossEncoder; SentenceTransformer('intfloat/multilingual-e5-base'); CrossEncoder('BAAI/bge-reranker-base', max_length=512)" && { success=1; break; }; \
      echo "[Lần $i] Tải model thất bại, đợi 5s rồi thử lại..."; \
      sleep 5; \
    done; \
    [ "$success" = "1" ] || { echo "LỖI: tải model thất bại sau 5 lần thử"; exit 1; }

# Chromium cho Playwright (crawler — module Quản lý Dữ liệu Bộ/Ngành)
RUN playwright install --with-deps chromium

# Copy source
COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
