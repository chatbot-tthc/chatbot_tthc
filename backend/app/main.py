from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1 import health, chat, stats
from app.api.v1 import hoso, pdf, agencies

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="API hệ thống Chatbot AI tra cứu thủ tục hành chính công — VNPT TPHCM",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — cho phép Next.js frontend gọi API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Đăng ký routes
app.include_router(health.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(stats.router, prefix="/api/v1")
app.include_router(hoso.router, prefix="/api/v1/hoso")
app.include_router(pdf.router, prefix="/api/v1/pdf")
app.include_router(agencies.router, prefix="/api/v1/agencies")


@app.get("/", tags=["Root"])
async def root():
    return {
        "message": "Chatbot TTHC API đang chạy",
        "docs": "/docs",
        "version": settings.APP_VERSION,
    }