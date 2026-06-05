from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.database import get_db
from app.core.config import settings
from app.models.schemas import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check(db: AsyncSession = Depends(get_db)):
    """Kiểm tra trạng thái hệ thống"""
    # Check DB
    db_status = "ok"
    try:
        await db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"error: {str(e)}"

    # Check ChromaDB (placeholder)
    vector_db_status = "ok"

    return HealthResponse(
        status="ok",
        version=settings.APP_VERSION,
        database=db_status,
        vector_db=vector_db_status,
    )
