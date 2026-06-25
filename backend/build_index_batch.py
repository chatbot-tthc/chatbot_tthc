"""
build_index_batch.py - Phiên bản tối ưu: batch embedding + batch upsert
Nhanh hơn build_index.py gốc ~20-50 lần.
"""
import json
import os
from pathlib import Path
from sentence_transformers import SentenceTransformer
import chromadb
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent.parent  # chatbot-tthc/
load_dotenv(ROOT_DIR / ".env")

RAW_DIR = Path("/scripts/crawler/data/raw")

EMBEDDING_MODEL = "intfloat/multilingual-e5-base"
CHROMA_HOST = os.environ.get("CHROMA_HOST", "chromadb")
CHROMA_PORT = int(os.environ.get("CHROMA_PORT", 8000))
COLLECTION_NAME = "tthc_documents"
BATCH_SIZE = 200  # embed + upsert 200 chunk mỗi lần

SECTION_FIELDS = [
    "trinh_tu_thuc_hien", "cach_thuc_thuc_hien", "thanh_phan_ho_so",
    "doi_tuong_thuc_hien", "ket_qua_xu_ly", "can_cu_phap_ly", "yeu_cau_dieu_kien",
]
SECTION_TITLES = {
    "trinh_tu_thuc_hien": "Trình tự thực hiện",
    "cach_thuc_thuc_hien": "Cách thức thực hiện (gồm thời gian, phí/lệ phí)",
    "thanh_phan_ho_so": "Thành phần hồ sơ",
    "doi_tuong_thuc_hien": "Đối tượng thực hiện",
    "ket_qua_xu_ly": "Kết quả thực hiện",
    "can_cu_phap_ly": "Căn cứ pháp lý",
    "yeu_cau_dieu_kien": "Yêu cầu, điều kiện thực hiện",
}
EMPTY_VALUES = {"", "Không có thông tin", "--"}
CHUNK_SIZE_WORDS = 350
CHUNK_OVERLAP_WORDS = 50


def split_text(text, size, overlap):
    words = text.split()
    if len(words) <= size:
        return [text]
    chunks, start = [], 0
    while start < len(words):
        end = min(start + size, len(words))
        chunks.append(" ".join(words[start:end]))
        if end == len(words):
            break
        start = end - overlap
    return chunks


def build_chunks(raw, bo_nganh, source_path):
    ma = raw.get("ma_thu_tuc", source_path.stem)
    ten = raw.get("ten_thu_tuc", "")
    chunks = []
    for field in SECTION_FIELDS:
        value = (raw.get(field) or "").strip()
        if not value or value in EMPTY_VALUES:
            continue
        title = SECTION_TITLES[field]
        for idx, piece in enumerate(split_text(value, CHUNK_SIZE_WORDS, CHUNK_OVERLAP_WORDS)):
            chunks.append({
                "id": f"{ma}__{field}__{idx}",
                "text": f"Thủ tục: {ten}\n{title}:\n{piece}",
                "metadata": {
                    "ma_thu_tuc": ma, "ten_thu_tuc": ten, "bo_nganh": bo_nganh,
                    "linh_vuc": raw.get("linh_vuc", ""),
                    "cap_thuc_hien": raw.get("cap_thuc_hien", ""),
                    "section": field, "section_title": title, "chunk_index": idx,
                },
            })
    return chunks


def main():
    print("Đang tải model embedding (dùng cache nếu đã tải)...")
    model = SentenceTransformer(EMBEDDING_MODEL)
    print("Đã tải xong model embedding.")

    client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
    try:
        client.delete_collection(COLLECTION_NAME)
        print("Đã xóa collection cũ.")
    except Exception:
        pass
    collection = client.get_or_create_collection(
        COLLECTION_NAME, metadata={"hnsw:space": "cosine"}
    )

    files = sorted(RAW_DIR.glob("*/*.json"))
    print(f"Tìm thấy {len(files)} file JSON. Đang đọc và tạo chunks...")

    all_chunks = []
    for jf in files:
        bo_nganh = jf.parent.name
        with open(jf, encoding="utf-8") as f:
            raw = json.load(f)
        all_chunks.extend(build_chunks(raw, bo_nganh, jf))

    total_chunks = len(all_chunks)
    print(f"Tổng: {total_chunks} chunks. Bắt đầu batch embed + upsert (batch={BATCH_SIZE})...")

    done = 0
    for i in range(0, total_chunks, BATCH_SIZE):
        batch = all_chunks[i:i + BATCH_SIZE]
        texts = [f"passage: {c['text']}" for c in batch]
        embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=False).tolist()
        collection.upsert(
            ids=[c["id"] for c in batch],
            embeddings=embeddings,
            documents=[c["text"] for c in batch],
            metadatas=[c["metadata"] for c in batch],
        )
        done += len(batch)
        print(f"  [{done}/{total_chunks}] {done*100//total_chunks}%")

    print(f"\nHOÀN TẤT! Tổng: {collection.count()} documents trong collection.")


if __name__ == "__main__":
    main()
