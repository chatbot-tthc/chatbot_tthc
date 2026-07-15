"""
Module Quản lý Dữ liệu Bộ/Ngành — xem danh sách, bật/tắt, thêm bộ/ngành mới,
và trigger crawl/cập nhật.
"""
import re
import subprocess
import sys
from io import BytesIO
from pathlib import Path

import openpyxl
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.db_models import Agency
from app.models.schemas import AgencyResponse, AgencyToggleRequest, AgencyCrawlAcceptedResponse
from app.services.agency_filter import invalidate_agency_cache

router = APIRouter()

# /app/scripts/ingestion/run_crawl_job.py trong container (xem volume "./scripts:/app/scripts" ở docker-compose.yml)
BACKEND_ROOT = Path(__file__).resolve().parents[3]
RUN_CRAWL_JOB_SCRIPT = BACKEND_ROOT / "scripts" / "ingestion" / "run_crawl_job.py"
# Excel do người dùng upload khi thêm bộ/ngành mới — crawl_tthc.py tự quét thư mục này
EXCELS_DIR = BACKEND_ROOT / "scripts" / "crawler" / "data" / "excels"
CODE_PATTERN = re.compile(r"[a-z0-9]+(-[a-z0-9]+)*")


async def _get_agency_or_404(code: str, db: AsyncSession) -> Agency:
    result = await db.execute(select(Agency).where(Agency.code == code))
    agency = result.scalar_one_or_none()
    if agency is None:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy bộ/ngành '{code}'")
    return agency


@router.get("", response_model=list[AgencyResponse], tags=["Agencies"])
async def list_agencies(db: AsyncSession = Depends(get_db)):
    """Danh sách bộ/ngành + số thủ tục + trạng thái bật/tắt/crawl."""
    result = await db.execute(select(Agency).order_by(Agency.display_name))
    return result.scalars().all()


@router.post("", response_model=AgencyResponse, status_code=status.HTTP_201_CREATED, tags=["Agencies"])
async def create_agency(
    code: str = Form(...),
    display_name: str = Form(...),
    excel: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Đăng ký 1 bộ/ngành hoàn toàn mới, kèm file Excel danh sách mã thủ tục.
    Không tự động crawl — dùng nút "Cập nhật" (POST /{code}/crawl) sau khi tạo.
    """
    code = code.strip().lower()
    if not CODE_PATTERN.fullmatch(code):
        raise HTTPException(
            status_code=400,
            detail="Mã bộ/ngành chỉ được chứa chữ thường, số và dấu gạch ngang (VD: toa-an-nhan-dan).",
        )

    existing = await db.execute(select(Agency).where(Agency.code == code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Bộ/ngành '{code}' đã tồn tại.")

    if not excel.filename.endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Chỉ chấp nhận file Excel (.xlsx).")

    content = await excel.read()
    try:
        wb = openpyxl.load_workbook(BytesIO(content))
        ws = wb.active
        ma_thu_tuc_codes = [
            str(row[0]).strip()
            for row in ws.iter_rows(min_row=3, values_only=True)
            if row and row[0]
        ]
    except Exception:
        raise HTTPException(status_code=400, detail="File Excel không đọc được hoặc sai định dạng.")

    if not ma_thu_tuc_codes:
        raise HTTPException(
            status_code=400,
            detail="Không tìm thấy mã thủ tục nào trong file (cần dữ liệu ở cột A, từ dòng 3 trở đi).",
        )

    EXCELS_DIR.mkdir(parents=True, exist_ok=True)
    (EXCELS_DIR / f"{code}.xlsx").write_bytes(content)

    agency = Agency(
        code=code,
        display_name=display_name.strip(),
        is_active=True,
        crawl_status="idle",
        thu_tuc_count=0,
        source_excel=f"data/excels/{code}.xlsx",
    )
    db.add(agency)
    await db.flush()
    await db.refresh(agency)
    invalidate_agency_cache()
    return agency


@router.patch("/{code}/toggle", response_model=AgencyResponse, tags=["Agencies"])
async def toggle_agency(
    code: str,
    body: AgencyToggleRequest,
    db: AsyncSession = Depends(get_db),
):
    """Bật/tắt 1 bộ/ngành — RAG sẽ ngay lập tức không tìm trong dữ liệu bộ bị tắt."""
    agency = await _get_agency_or_404(code, db)
    agency.is_active = body.is_active
    await db.flush()
    invalidate_agency_cache()
    return agency


@router.post(
    "/{code}/crawl",
    response_model=AgencyCrawlAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["Agencies"],
)
async def trigger_crawl(code: str, db: AsyncSession = Depends(get_db)):
    """
    Kích hoạt crawl + index lại dữ liệu mới nhất cho 1 bộ/ngành.
    Chạy nền bằng subprocess độc lập (KHÔNG chặn event loop của FastAPI) —
    xem scripts/ingestion/run_crawl_job.py.
    """
    agency = await _get_agency_or_404(code, db)

    if agency.crawl_status == "crawling":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Bộ '{code}' đang crawl dở, vui lòng đợi xong rồi thử lại.",
        )

    agency.crawl_status = "crawling"
    agency.last_crawl_error = None
    await db.flush()

    subprocess.Popen(
        [sys.executable, str(RUN_CRAWL_JOB_SCRIPT), "--bo-nganh", code],
        cwd=str(RUN_CRAWL_JOB_SCRIPT.parent),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    return AgencyCrawlAcceptedResponse(
        code=code,
        crawl_status="crawling",
        message="Đã bắt đầu crawl/cập nhật ở nền. Dùng GET /{code}/status để theo dõi tiến độ.",
    )


@router.get("/{code}/status", response_model=AgencyResponse, tags=["Agencies"])
async def get_agency_status(code: str, db: AsyncSession = Depends(get_db)):
    """Poll trạng thái crawl hiện tại (idle | crawling | failed) của 1 bộ/ngành."""
    return await _get_agency_or_404(code, db)
