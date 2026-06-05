import time
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.schemas import ChatRequest, ChatResponse, SessionCreate, SessionResponse
from app.models.db_models import ChatSession, ChatMessage, ApiLog
from app.services.rag_pipeline import RAGPipeline

router = APIRouter()
rag = RAGPipeline()


@router.post("/sessions", response_model=SessionResponse, tags=["Chat"])
async def create_session(
    body: SessionCreate,
    db: AsyncSession = Depends(get_db)
):
    """Tạo phiên chat mới"""
    session = ChatSession(session_name=body.session_name)
    db.add(session)
    await db.flush()
    return session


@router.post("/chat", response_model=ChatResponse, tags=["Chat"])
async def chat(
    body: ChatRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Nhận câu hỏi và trả lời qua RAG Pipeline:
    1. Embed câu hỏi
    2. Tìm kiếm ngữ nghĩa (ChromaDB)
    3. Reranker
    4. Fallback Handler nếu score thấp
    5. Gemini Pro sinh câu trả lời
    """
    start_time = time.time()

    # Tạo session nếu chưa có
    session_id = body.session_id
    if not session_id:
        session = ChatSession()
        db.add(session)
        await db.flush()
        session_id = session.id

    # Lưu câu hỏi vào DB
    user_msg = ChatMessage(
        session_id=session_id,
        role="user",
        content=body.question,
    )
    db.add(user_msg)

    # Gọi RAG Pipeline
    try:
        result = await rag.query(body.question)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG pipeline error: {str(e)}")

    response_time = int((time.time() - start_time) * 1000)

    # Lưu câu trả lời vào DB
    assistant_msg = ChatMessage(
        session_id=session_id,
        role="assistant",
        content=result["answer"],
        retrieved_chunks=result.get("chunks"),
        similarity_scores=result.get("scores"),
        is_fallback=result.get("is_fallback", False),
        response_time_ms=response_time,
    )
    db.add(assistant_msg)

    # Log API
    log = ApiLog(
        session_id=session_id,
        endpoint="/api/v1/chat",
        method="POST",
        status_code=200,
        response_time_ms=response_time,
    )
    db.add(log)

    return ChatResponse(
        session_id=session_id,
        answer=result["answer"],
        is_fallback=result.get("is_fallback", False),
        retrieved_chunks=result.get("retrieved_chunks", []),
        response_time_ms=response_time,
    )
