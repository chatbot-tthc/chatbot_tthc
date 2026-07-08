"""Pydantic schemas — request/response validation"""
from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime


# ── Chat ──────────────────────────────────────────────
class ChatRequest(BaseModel):
    session_id: Optional[UUID] = None
    question: str = Field(..., min_length=1, max_length=2000, description="Câu hỏi của người dùng")

    class Config:
        json_schema_extra = {
            "example": {
                "question": "Thủ tục đăng ký kết hôn cần những giấy tờ gì?"
            }
        }


class RetrievedChunk(BaseModel):
    content: str
    document_title: str
    ma_thu_tuc: Optional[str] = None
    bo_nganh: Optional[str] = None
    score: float
    pdf_content: Optional[str] = None
    section: Optional[str] = None
    section_title: Optional[str] = None

class ActionButton(BaseModel):         
    label: str
    url: str
    type: str

class ChatResponse(BaseModel):
    session_id: UUID
    answer: str
    is_fallback: bool = False
    retrieved_chunks: List[RetrievedChunk] = []
    response_time_ms: int
    action_buttons: List[ActionButton] = []


# ── Session ────────────────────────────────────────────
class SessionCreate(BaseModel):
    session_name: Optional[str] = None


class SessionResponse(BaseModel):
    id: UUID
    session_name: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Health ─────────────────────────────────────────────
class HealthResponse(BaseModel):
    status: str
    version: str
    database: str
    vector_db: str