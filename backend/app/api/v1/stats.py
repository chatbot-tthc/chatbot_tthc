from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from app.core.database import get_db
from app.models.db_models import ChatSession, ChatMessage
from collections import Counter

router = APIRouter()


@router.get("/stats", tags=["Dashboard"])
async def get_stats(db: AsyncSession = Depends(get_db)):
    """
    Thống kê tổng quan cho Dashboard:
    - Tổng sessions, tổng câu hỏi
    - Tỷ lệ fallback
    - Avg response time
    - Top thủ tục được hỏi nhiều nhất
    - Lượng câu hỏi theo ngày (7 ngày gần nhất)
    """

    # Tổng sessions
    total_sessions = await db.scalar(select(func.count()).select_from(ChatSession))

    # Tổng câu hỏi (user messages)
    total_questions = await db.scalar(
        select(func.count()).select_from(ChatMessage).where(ChatMessage.role == "user")
    )

    # Tổng câu trả lời assistant
    total_answers = await db.scalar(
        select(func.count()).select_from(ChatMessage).where(ChatMessage.role == "assistant")
    )

    # Fallback count
    fallback_count = await db.scalar(
        select(func.count()).select_from(ChatMessage).where(
            ChatMessage.role == "assistant",
            ChatMessage.is_fallback == True,
        )
    )

    # Avg response time (ms)
    avg_response_time = await db.scalar(
        select(func.avg(ChatMessage.response_time_ms)).where(
            ChatMessage.role == "assistant",
            ChatMessage.response_time_ms.isnot(None),
        )
    )

    # Top thủ tục — đếm từ retrieved_chunks JSON
    result = await db.execute(
        select(ChatMessage.retrieved_chunks).where(
            ChatMessage.role == "assistant",
            ChatMessage.is_fallback == False,
            ChatMessage.retrieved_chunks.isnot(None),
        )
    )
    thu_tuc_counter: Counter = Counter()
    for (chunks,) in result.fetchall():
        if not isinstance(chunks, list):
            continue
        for chunk in chunks:
            if not isinstance(chunk, dict):
                continue
            name = chunk.get("document_title") or chunk.get("ma_thu_tuc", "")
            if name:
                thu_tuc_counter[name] += 1

    top_thu_tuc = [
        {"ten_thu_tuc": name, "count": count}
        for name, count in thu_tuc_counter.most_common(10)
    ]

    # Câu hỏi theo ngày (7 ngày gần nhất)
    daily_result = await db.execute(
        text("""
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM chat_messages
            WHERE role = 'user'
              AND created_at >= NOW() - INTERVAL '7 days'
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        """)
    )
    daily_questions = [
        {"date": str(row.date), "count": row.count}
        for row in daily_result.fetchall()
    ]

    fallback_rate = round(
        (fallback_count / total_answers * 100) if total_answers else 0, 1
    )

    return {
        "total_sessions": total_sessions or 0,
        "total_questions": total_questions or 0,
        "fallback_count": fallback_count or 0,
        "fallback_rate": fallback_rate,
        "avg_response_time_ms": round(avg_response_time or 0),
        "top_thu_tuc": top_thu_tuc,
        "daily_questions": daily_questions,
    }