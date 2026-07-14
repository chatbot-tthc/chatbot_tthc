"""
Module Quản lý Dữ liệu Bộ/Ngành — xem danh sách, bật/tắt, và trigger crawl/cập nhật.
"""
import subprocess
import sys
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
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
