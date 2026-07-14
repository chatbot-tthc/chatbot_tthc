"""
Seed bảng `agencies` dựa trên dữ liệu THẬT đang có trong ChromaDB — không đoán tay.
Quét toàn bộ metadata trong collection, gom theo `bo_nganh`, đếm số mã thủ tục
(ma_thu_tuc) duy nhất của từng bộ, rồi upsert vào Postgres.

Cách dùng (chạy trên máy/VM có thể kết nối tới ChromaDB nội bộ, VD trong container backend
hoặc SSH vào GCP VM):
    python seed_agencies.py            # dò + ghi thẳng vào Postgres
    python seed_agencies.py --dry-run  # chỉ in ra SQL sẽ chạy, không ghi gì cả
"""
import argparse
import asyncio
import os
import uuid
from pathlib import Path

import chromadb
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent.parent  # chatbot-tthc/
load_dotenv(ROOT_DIR / ".env")

CHROMA_HOST = os.environ.get("CHROMA_HOST", "localhost")
CHROMA_PORT = int(os.environ.get("CHROMA_PORT", 8001))
COLLECTION_NAME = os.environ.get("CHROMA_COLLECTION", "tthc_documents")

POSTGRES_HOST = os.environ.get("POSTGRES_HOST", "localhost")
POSTGRES_PORT = int(os.environ.get("POSTGRES_PORT", 5432))
POSTGRES_DB = os.environ.get("POSTGRES_DB", "chatbot_tthc")
POSTGRES_USER = os.environ.get("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.environ.get("POSTGRES_PASSWORD", "postgres")

BATCH_SIZE = 5000

# Tên hiển thị cho các bộ đã biết trước (dựa theo scripts/crawler/crawl_tthc.py::ALL_EXCELS).
# Nếu ChromaDB có code lạ không nằm trong map này, script tự phát sinh tên hiển thị tạm
# từ code (VD "bo-abc-def" -> "Bo Abc Def"), bạn có thể sửa lại sau trong Dashboard.
DISPLAY_NAMES = {
    "bo-cong-an": "Bộ Công an",
    "bo-tu-phap": "Bộ Tư pháp",
    "ngan-hang-nha-nuoc": "Ngân hàng Nhà nước Việt Nam",
    "bo-tai-chinh": "Bộ Tài chính",
    "bo-xay-dung": "Bộ Xây dựng",
    "bo-nong-nghiep-mt": "Bộ Nông nghiệp và Môi trường",
}

SOURCE_EXCELS = {
    "bo-cong-an": "danh-sach-tthc-BoCongAn.xlsx",
    "bo-tu-phap": "danh-sach-tthc-BoTuPhap.xlsx",
    "ngan-hang-nha-nuoc": "danh-sach-tthc-NganhangNhanuocVietNam.xlsx",
    "bo-tai-chinh": "danh-sach-tthc-BoTaiChinh.xlsx",
    "bo-xay-dung": "danh-sach-tthc-BoXayDung.xlsx",
    "bo-nong-nghiep-mt": "danh-sach-tthc-NongNghiepvaMoiTruong.xlsx",
}


def guess_display_name(code: str) -> str:
    return code.replace("-", " ").title()


def scan_chromadb() -> dict[str, set[str]]:
    """Trả về {bo_nganh: {ma_thu_tuc, ...}} bằng cách quét toàn bộ metadata trong Chroma."""
    client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
    collection = client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )
    total = collection.count()
    print(f"Tổng số chunk trong collection '{COLLECTION_NAME}': {total}")

    by_bo_nganh: dict[str, set[str]] = {}
    offset = 0
    while offset < total:
        batch = collection.get(
            include=["metadatas"],
            limit=BATCH_SIZE,
            offset=offset,
        )
        for meta in batch["metadatas"]:
            bo_nganh = (meta or {}).get("bo_nganh") or "khong-xac-dinh"
            ma_thu_tuc = (meta or {}).get("ma_thu_tuc") or ""
            by_bo_nganh.setdefault(bo_nganh, set())
            if ma_thu_tuc:
                by_bo_nganh[bo_nganh].add(ma_thu_tuc)
        offset += BATCH_SIZE

    return by_bo_nganh


def build_rows(by_bo_nganh: dict[str, set[str]]) -> list[dict]:
    rows = []
    for code, ma_thu_tuc_set in sorted(by_bo_nganh.items()):
        rows.append({
            "id": str(uuid.uuid4()),
            "code": code,
            "display_name": DISPLAY_NAMES.get(code, guess_display_name(code)),
            "thu_tuc_count": len(ma_thu_tuc_set),
            "source_excel": SOURCE_EXCELS.get(code),
        })
    return rows


def print_summary(rows: list[dict]) -> None:
    print("\n=== Bộ/ngành phát hiện được trong ChromaDB ===")
    print(f"{'code':<22} {'display_name':<32} {'thu_tuc_count':>13}")
    for r in rows:
        print(f"{r['code']:<22} {r['display_name']:<32} {r['thu_tuc_count']:>13}")
    print()


def build_sql(rows: list[dict]) -> str:
    statements = []
    for r in rows:
        display_name = r["display_name"].replace("'", "''")
        source_excel = f"'{r['source_excel']}'" if r["source_excel"] else "NULL"
        statements.append(
            "INSERT INTO agencies (id, code, display_name, is_active, thu_tuc_count, "
            "crawl_status, source_excel, created_at, updated_at)\n"
            f"VALUES ('{r['id']}', '{r['code']}', '{display_name}', true, {r['thu_tuc_count']}, "
            f"'idle', {source_excel}, now(), now())\n"
            "ON CONFLICT (code) DO UPDATE SET\n"
            "  thu_tuc_count = EXCLUDED.thu_tuc_count,\n"
            "  updated_at = now();"
        )
    return "\n\n".join(statements)


async def write_to_postgres(rows: list[dict]) -> None:
    import asyncpg  # import trễ để --dry-run không bắt buộc phải có asyncpg cài sẵn

    conn = await asyncpg.connect(
        host=POSTGRES_HOST, port=POSTGRES_PORT,
        database=POSTGRES_DB, user=POSTGRES_USER, password=POSTGRES_PASSWORD,
    )
    try:
        for r in rows:
            await conn.execute(
                """
                INSERT INTO agencies (id, code, display_name, is_active, thu_tuc_count,
                                       crawl_status, source_excel, created_at, updated_at)
                VALUES ($1, $2, $3, true, $4, 'idle', $5, now(), now())
                ON CONFLICT (code) DO UPDATE SET
                    thu_tuc_count = EXCLUDED.thu_tuc_count,
                    updated_at = now()
                """,
                uuid.UUID(r["id"]), r["code"], r["display_name"],
                r["thu_tuc_count"], r["source_excel"],
            )
        print(f"Đã ghi {len(rows)} bộ/ngành vào bảng agencies.")
    finally:
        await conn.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true",
                         help="Chỉ in SQL sẽ chạy, không ghi vào Postgres")
    args = parser.parse_args()

    by_bo_nganh = scan_chromadb()
    if not by_bo_nganh:
        print("Không tìm thấy metadata nào trong ChromaDB — kiểm tra lại CHROMA_HOST/PORT/COLLECTION.")
        return

    rows = build_rows(by_bo_nganh)
    print_summary(rows)

    if args.dry_run:
        print("=== SQL sẽ chạy (--dry-run, chưa ghi gì) ===\n")
        print(build_sql(rows))
    else:
        asyncio.run(write_to_postgres(rows))


if __name__ == "__main__":
    main()
