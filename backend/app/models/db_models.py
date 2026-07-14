"""
Database models (A0.3) — Schema PostgreSQL
Tables: users, documents, chat_sessions, chat_messages, api_logs, agencies
"""
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, Integer, Float,
    Boolean, DateTime, ForeignKey, JSON
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(100), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=True)
    role = Column(String(50), default="user")  # user | admin | can_bo
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)


class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(500), nullable=False)
    ma_thu_tuc = Column(String(50), nullable=True, index=True)
    so_quyet_dinh = Column(String(100), nullable=True)
    linh_vuc = Column(String(255), nullable=True)
    file_path = Column(String(500), nullable=True)
    file_type = Column(String(20), nullable=True)  # pdf | docx
    chunk_count = Column(Integer, default=0)
    indexed = Column(Boolean, default=False)
    indexed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    metadata_json = Column(JSON, nullable=True)


class Agency(Base):
    """Bộ/ngành nguồn dữ liệu — quản lý bật/tắt và crawl (module Quản lý Dữ liệu Bộ/Ngành)."""
    __tablename__ = "agencies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(100), unique=True, nullable=False, index=True)  # khớp metadata "bo_nganh" trong ChromaDB, VD "bo-tu-phap"
    display_name = Column(String(255), nullable=False)  # "Bộ Tư pháp"
    is_active = Column(Boolean, default=True, nullable=False)  # cột toggle — RAG chỉ tìm trong các bộ is_active=True
    thu_tuc_count = Column(Integer, default=0, nullable=False)  # cache số thủ tục, cập nhật sau mỗi lần crawl/seed
    crawl_status = Column(String(20), default="idle", nullable=False)  # idle | crawling | failed
    last_crawled_at = Column(DateTime(timezone=True), nullable=True)
    last_crawl_error = Column(Text, nullable=True)
    source_excel = Column(String(255), nullable=True)  # tên file Excel danh sách mã thủ tục dùng để crawl bộ này
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    session_name = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_active = Column(Boolean, default=True)


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id"), nullable=False)
    role = Column(String(20), nullable=False)  # user | assistant
    content = Column(Text, nullable=False)
    # RAG metadata
    retrieved_chunks = Column(JSON, nullable=True)   # top-K chunks dùng để trả lời
    similarity_scores = Column(JSON, nullable=True)  # điểm của từng chunk
    is_fallback = Column(Boolean, default=False)     # True nếu dùng fallback handler
    response_time_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ApiLog(Base):
    __tablename__ = "api_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), nullable=True)
    endpoint = Column(String(255), nullable=False)
    method = Column(String(10), nullable=False)
    status_code = Column(Integer, nullable=True)
    request_body = Column(JSON, nullable=True)
    response_time_ms = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
