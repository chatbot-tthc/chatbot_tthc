"""
Orchestrator cho nút "Cập nhật" trên Dashboard Quản lý Dữ liệu Bộ/Ngành.
Chạy CHUỖI: crawl (crawl_tthc.py) -> build index (build_index.py) -> cập nhật
trạng thái + số lượng thủ tục trong Postgres (bảng agencies).

Được gọi như 1 subprocess độc lập từ API (POST /api/v1/agencies/{code}/crawl),
KHÔNG chạy trong tiến trình FastAPI — vì crawl dùng Playwright đồng bộ, chạy
hàng chục phút, sẽ đứng cả server nếu gọi trực tiếp trong event loop.

Cách dùng:
    python run_crawl_job.py --bo-nganh bo-tu-phap
"""
import argparse
import asyncio
import os
import subprocess
import sys
import traceback
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent.parent  # chatbot-tthc/
load_dotenv(ROOT_DIR / ".env")

SCRIPT_DIR = Path(__file__).resolve().parent
CRAWLER_DIR = SCRIPT_DIR.parent / "crawler"

POSTGRES_HOST = os.environ.get("POSTGRES_HOST", "localhost")
POSTGRES_PORT = int(os.environ.get("POSTGRES_PORT", 5432))
POSTGRES_DB = os.environ.get("POSTGRES_DB", "chatbot_tthc")
POSTGRES_USER = os.environ.get("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.environ.get("POSTGRES_PASSWORD", "postgres")

# Tái sử dụng logic quét ChromaDB đã có trong seed_agencies.py (cùng thư mục)
sys.path.insert(0, str(SCRIPT_DIR))
from seed_agencies import scan_chromadb  # noqa: E402


async def set_status(code: str, status: str, error: str | None = None) -> None:
    import asyncpg
    conn = await asyncpg.connect(
        host=POSTGRES_HOST, port=POSTGRES_PORT,
        database=POSTGRES_DB, user=POSTGRES_USER, password=POSTGRES_PASSWORD,
    )
    try:
        await conn.execute(
            "UPDATE agencies SET crawl_status = $1, last_crawl_error = $2, updated_at = now() WHERE code = $3",
            status, error, code,
        )
    finally:
        await conn.close()


async def finish_success(code: str, thu_tuc_count: int) -> None:
    import asyncpg
    conn = await asyncpg.connect(
        host=POSTGRES_HOST, port=POSTGRES_PORT,
        database=POSTGRES_DB, user=POSTGRES_USER, password=POSTGRES_PASSWORD,
    )
    try:
        await conn.execute(
            """
            UPDATE agencies
            SET crawl_status = 'idle', last_crawl_error = NULL,
                thu_tuc_count = $1, last_crawled_at = now(), updated_at = now()
            WHERE code = $2
            """,
            thu_tuc_count, code,
        )
    finally:
        await conn.close()


def run_step(cmd: list[str], cwd: Path) -> None:
    print(f"\n>>> Chạy: {' '.join(cmd)} (cwd={cwd})")
    result = subprocess.run(cmd, cwd=str(cwd))
    if result.returncode != 0:
        raise RuntimeError(f"Lệnh thất bại (exit code {result.returncode}): {' '.join(cmd)}")


async def main(bo_nganh: str) -> None:
    await set_status(bo_nganh, "crawling")
    try:
        # 1. Crawl (crawl -> reorganize -> restructure -> download_pdf, đều nằm trong __main__ của crawl_tthc.py)
        run_step(
            [sys.executable, "crawl_tthc.py", "--bo-nganh", bo_nganh],
            cwd=CRAWLER_DIR,
        )

        # 2. Build index — chunk + embed + upsert vào ChromaDB (có resume, an toàn chạy lại)
        run_step(
            [sys.executable, "build_index.py"],
            cwd=SCRIPT_DIR,
        )

        # 3. Đếm lại số thủ tục thật của bộ này từ ChromaDB, cập nhật Postgres
        by_bo_nganh = scan_chromadb()
        thu_tuc_count = len(by_bo_nganh.get(bo_nganh, set()))
        await finish_success(bo_nganh, thu_tuc_count)
        print(f"\n✅ Cập nhật xong bộ '{bo_nganh}': {thu_tuc_count} thủ tục.")

    except Exception as e:
        error_msg = f"{e}\n{traceback.format_exc()}"[:4000]
        await set_status(bo_nganh, "failed", error_msg)
        print(f"\n❌ Lỗi khi cập nhật bộ '{bo_nganh}': {e}")
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--bo-nganh", required=True, help="Code bộ ngành cần crawl/cập nhật, VD bo-tu-phap")
    args = parser.parse_args()
    asyncio.run(main(args.bo_nganh))
