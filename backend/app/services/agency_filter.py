"""
Cache trong bộ nhớ cho danh sách bo_nganh đang is_active=True (bảng agencies).
Dùng để lọc ChromaDB tại thời điểm truy vấn — xem RAGPipeline._retrieve().

TTL ngắn (30s) để tránh query Postgres ở mỗi câu hỏi chat, nhưng vẫn refresh
gần như ngay lập tức. Khi người dùng bấm Toggle, gọi invalidate_agency_cache()
để lần truy vấn tiếp theo lấy dữ liệu mới ngay, không phải chờ hết TTL.
"""
import time
from sqlalchemy import select, func
from app.core.database import AsyncSessionLocal
from app.models.db_models import Agency

_TTL_SECONDS = 30.0
_UNSET = object()
_cache = {"value": _UNSET, "ts": 0.0}


async def get_active_agency_codes() -> list[str] | None:
    """
    Trả về danh sách code các bộ đang bật, để dùng trong `where={"bo_nganh": {"$in": ...}}`.
    Trả về None nếu bảng `agencies` chưa có dòng nào (chưa seed) — nghĩa là KHÔNG áp
    filter gì cả, để tránh chatbot đột nhiên không tìm được gì khi tính năng toggle
    chưa được cấu hình xong.
    """
    now = time.monotonic()
    if _cache["value"] is not _UNSET and (now - _cache["ts"]) < _TTL_SECONDS:
        return _cache["value"]

    async with AsyncSessionLocal() as session:
        total = await session.scalar(select(func.count()).select_from(Agency))
        if not total:
            value = None
        else:
            result = await session.execute(select(Agency.code).where(Agency.is_active.is_(True)))
            value = [row[0] for row in result.all()]

    _cache["value"] = value
    _cache["ts"] = now
    return value


def invalidate_agency_cache() -> None:
    _cache["value"] = _UNSET
    _cache["ts"] = 0.0
