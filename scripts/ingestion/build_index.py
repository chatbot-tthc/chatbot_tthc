"""
A2 - Offline Indexing Pipeline (gộp normalize + chunk + local embedding + nạp ChromaDB)

Cách dùng:
    python build_index.py --limit 5     # test thử 5 thủ tục đầu
    python build_index.py               # chạy full 2639 thủ tục
    python build_index.py --reset       # xóa dữ liệu cũ trong ChromaDB, chạy lại từ đầu
"""
import argparse
import json
import os
from pathlib import Path

from sentence_transformers import SentenceTransformer
import chromadb
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent.parent  # chatbot-tthc/
load_dotenv(ROOT_DIR / ".env")  # <-- đọc file .env ở thư mục gốc chatbot-tthc/

RAW_DIR = Path(__file__).resolve().parent.parent / "crawler" / "data" / "raw"
PROGRESS_FILE = Path(__file__).resolve().parent / "data" / "indexed_ids.txt"

EMBEDDING_MODEL = "intfloat/multilingual-e5-base"
EMBEDDING_DIM = 768
CHROMA_HOST = os.environ.get("CHROMA_HOST", "localhost")
CHROMA_PORT = int(os.environ.get("CHROMA_PORT", 8001))
COLLECTION_NAME = "tthc_documents"

print("Đang tải model embedding (lần đầu sẽ tải ~1.1GB, các lần sau dùng cache)...")
embedding_model = SentenceTransformer(EMBEDDING_MODEL)
print("Đã tải xong model embedding.")

SECTION_FIELDS = [
    "trinh_tu_thuc_hien",
    "cach_thuc_thuc_hien",
    "thanh_phan_ho_so",
    "doi_tuong_thuc_hien",
    "ket_qua_xu_ly",
    "can_cu_phap_ly",
    "yeu_cau_dieu_kien",
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
    chunks = []
    start = 0
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
            chunk_id = f"{ma}__{field}__{idx}"
            text = f"Thủ tục: {ten}\n{title}:\n{piece}"
            chunks.append({
                "id": chunk_id,
                "text": text,
                "metadata": {
                    "ma_thu_tuc": ma,
                    "ten_thu_tuc": ten,
                    "bo_nganh": bo_nganh,
                    "linh_vuc": raw.get("linh_vuc", ""),
                    "cap_thuc_hien": raw.get("cap_thuc_hien", ""),
                    "section": field,
                    "section_title": title,
                    "chunk_index": idx,
                },
            })
    return chunks


def load_progress():
    if PROGRESS_FILE.exists():
        return set(PROGRESS_FILE.read_text(encoding="utf-8").splitlines())
    return set()


def save_progress(chunk_id):
    PROGRESS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(PROGRESS_FILE, "a", encoding="utf-8") as f:
        f.write(chunk_id + "\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--reset", action="store_true")
    args = parser.parse_args()

    if args.reset and PROGRESS_FILE.exists():
        PROGRESS_FILE.unlink()

    client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
    if args.reset:
        try:
            client.delete_collection(COLLECTION_NAME)
        except Exception:
            pass
    collection = client.get_or_create_collection(
        COLLECTION_NAME, metadata={"hnsw:space": "cosine"}
    )

    done_ids = load_progress()
    files = sorted(RAW_DIR.glob("*/*.json"))
    if args.limit:
        files = files[: args.limit]

    total_chunks, skipped = 0, 0

    for jf in files:
        bo_nganh = jf.parent.name
        with open(jf, encoding="utf-8") as f:
            raw = json.load(f)

        for chunk in build_chunks(raw, bo_nganh, jf):
            if chunk["id"] in done_ids:
                skipped += 1
                continue

            try:
                embedding = embedding_model.encode(
                    f"passage: {chunk['text']}",
                    normalize_embeddings=True,
                ).tolist()
            except Exception as e:
                print(f"LỖI embedding {chunk['id']}: {e}")
                continue

            collection.upsert(
                ids=[chunk["id"]],
                embeddings=[embedding],
                documents=[chunk["text"]],
                metadatas=[chunk["metadata"]],
            )
            save_progress(chunk["id"])
            total_chunks += 1

            if total_chunks % 50 == 0:
                print(f"Đã nạp {total_chunks} chunk (bỏ qua {skipped} đã có)...")

    print(f"HOÀN TẤT: {total_chunks} chunk mới, {skipped} chunk đã có sẵn (skip).")
    print(f"Tổng số document trong collection: {collection.count()}")


if __name__ == "__main__":
    main()