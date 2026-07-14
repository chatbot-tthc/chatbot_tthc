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


# ── Agencies (Quản lý Dữ liệu Bộ/Ngành) ──────────────────
class AgencyResponse(BaseModel):
    id: UUID
    code: str
    display_name: str
    is_active: bool
    thu_tuc_count: int
    crawl_status: str
    last_crawled_at: Optional[datetime] = None
    last_crawl_error: Optional[str] = None

    class Config:
        from_attributes = True


class AgencyToggleRequest(BaseModel):
    is_active: bool


class AgencyCrawlAcceptedResponse(BaseModel):
    code: str
    crawl_status: str
    message: str


# ── Health ─────────────────────────────────────────────
class HealthResponse(BaseModel):
    status: str
    version: str
    database: str
    vector_db: str