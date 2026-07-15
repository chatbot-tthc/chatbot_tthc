"""
API endpoint: /api/v1/stats
Thống kê hiệu suất chatbot từ PostgreSQL (sessions, messages, fallback, response time)
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.database import get_db

router = APIRouter()


@router.get("/stats", tags=["Stats"])
async def get_stats(db: AsyncSession = Depends(get_db)):
    """Trả về thống kê tổng hợp cho Dashboard Chatbot"""

    # Tổng số sessions
    r = await db.execute(text("SELECT COUNT(*) FROM chat_sessions"))
    total_sessions = r.scalar() or 0

    # Tổng số messages của user (= số câu hỏi)
    r = await db.execute(text("SELECT COUNT(*) FROM chat_messages WHERE role = 'user'"))
    total_questions = r.scalar() or 0

    # Số câu fallback
    r = await db.execute(text("SELECT COUNT(*) FROM chat_messages WHERE role = 'assistant' AND is_fallback = TRUE"))
    fallback_count = r.scalar() or 0

    # Tỷ lệ fallback
    fallback_rate = round(fallback_count / total_questions * 100, 1) if total_questions > 0 else 0.0

    # Thời gian phản hồi trung bình
    r = await db.execute(text(
        "SELECT AVG(response_time_ms) FROM chat_messages WHERE role = 'assistant' AND response_time_ms IS NOT NULL"
    ))
    avg_ms = r.scalar()
    avg_response_time_ms = round(float(avg_ms), 0) if avg_ms else 0

    # Top thủ tục được hỏi nhiều nhất
    r = await db.execute(text("""
        SELECT rc->>'document_title' AS ten_thu_tuc, COUNT(*) AS cnt
        FROM chat_messages,
             jsonb_array_elements(replace(retrieved_chunks::text, chr(92) || 'u0000', '')::jsonb) AS rc
        WHERE role = 'assistant'
          AND is_fallback = FALSE
          AND retrieved_chunks IS NOT NULL
          AND jsonb_typeof(replace(retrieved_chunks::text, chr(92) || 'u0000', '')::jsonb) = 'array'
        GROUP BY rc->>'document_title'
        ORDER BY cnt DESC
        LIMIT 8
    """))
    top_thu_tuc = [
        {"ten_thu_tuc": row[0] or "Không xác định", "count": row[1]}
        for row in r.fetchall()
        if row[0]
    ]

    # Số câu hỏi theo ngày (7 ngày gần nhất)
    r = await db.execute(text("""
        SELECT DATE(created_at) AS ngay, COUNT(*) AS cnt
        FROM chat_messages
        WHERE role = 'user'
          AND created_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY ngay ASC
    """))
    daily_questions = [
        {"date": str(row[0]), "count": row[1]}
        for row in r.fetchall()
    ]

    return {
        "total_sessions": total_sessions,
        "total_questions": total_questions,
        "fallback_count": fallback_count,
        "fallback_rate": fallback_rate,
        "avg_response_time_ms": avg_response_time_ms,
        "top_thu_tuc": top_thu_tuc,
        "daily_questions": daily_questions,
    }