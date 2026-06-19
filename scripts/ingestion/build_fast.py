import json, os
from pathlib import Path
from sentence_transformers import SentenceTransformer
import chromadb
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(ROOT_DIR / ".env")

RAW_DIR = Path(__file__).resolve().parent.parent / "crawler" / "data" / "raw"
CHROMA_HOST = os.environ.get("CHROMA_HOST", "localhost")
CHROMA_PORT = int(os.environ.get("CHROMA_PORT", 8001))
COLLECTION_NAME = "tthc_documents"
BATCH_SIZE = 64

SECTION_FIELDS = ["trinh_tu_thuc_hien","cach_thuc_thuc_hien","thanh_phan_ho_so","doi_tuong_thuc_hien","ket_qua_xu_ly","can_cu_phap_ly","yeu_cau_dieu_kien"]
SECTION_TITLES = {"trinh_tu_thuc_hien":"Trình tự thực hiện","cach_thuc_thuc_hien":"Cách thức thực hiện","thanh_phan_ho_so":"Thành phần hồ sơ","doi_tuong_thuc_hien":"Đối tượng thực hiện","ket_qua_xu_ly":"Kết quả thực hiện","can_cu_phap_ly":"Căn cứ pháp lý","yeu_cau_dieu_kien":"Yêu cầu, điều kiện"}
EMPTY_VALUES = {"", "Không có thông tin", "--"}

def split_text(text, size=350, overlap=50):
    words = text.split()
    if len(words) <= size: return [text]
    chunks, start = [], 0
    while start < len(words):
        end = min(start + size, len(words))
        chunks.append(" ".join(words[start:end]))
        if end == len(words): break
        start = end - overlap
    return chunks

def build_chunks(raw, bo_nganh, stem):
    ma, ten = raw.get("ma_thu_tuc", stem), raw.get("ten_thu_tuc", "")
    chunks = []
    for field in SECTION_FIELDS:
        value = (raw.get(field) or "").strip()
        if not value or value in EMPTY_VALUES: continue
        title = SECTION_TITLES[field]
        for idx, piece in enumerate(split_text(value)):
            chunks.append({"id": f"{ma}__{field}__{idx}", "text": f"Thủ tục: {ten}\n{title}:\n{piece}", "metadata": {"ma_thu_tuc": ma, "ten_thu_tuc": ten, "bo_nganh": bo_nganh, "section": field}})
    return chunks

print("Tải model embedding...")
model = SentenceTransformer("intfloat/multilingual-e5-base")
print("Xong. Kết nối ChromaDB...")
client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
try: client.delete_collection(COLLECTION_NAME)
except: pass
col = client.get_or_create_collection(COLLECTION_NAME, metadata={"hnsw:space": "cosine"})

files = sorted(RAW_DIR.glob("*/*.json"))
print(f"Tìm thấy {len(files)} file JSON. Bắt đầu index...")

all_chunks = []
for jf in files:
    with open(jf, encoding="utf-8") as f:
        raw = json.load(f)
    all_chunks.extend(build_chunks(raw, jf.parent.name, jf.stem))

print(f"Tổng {len(all_chunks)} chunks. Đang embed theo batch {BATCH_SIZE}...")
for i in range(0, len(all_chunks), BATCH_SIZE):
    batch = all_chunks[i:i+BATCH_SIZE]
    texts = [f"passage: {c['text']}" for c in batch]
    embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=False).tolist()
    col.upsert(ids=[c["id"] for c in batch], embeddings=embeddings, documents=[c["text"] for c in batch], metadatas=[c["metadata"] for c in batch])
    if (i // BATCH_SIZE + 1) % 10 == 0:
        print(f"  {i+len(batch)}/{len(all_chunks)} chunks...")

print(f"HOÀN TẤT! Tổng: {col.count()} documents trong ChromaDB.")
