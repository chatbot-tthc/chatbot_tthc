from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Chatbot TTHC API"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    # Database
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "chatbot_tthc"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

     # GCP Vertex AI
    GCP_PROJECT: str = "vocal-door-443401-g3"
    GCP_LOCATION: str = "us-central1"   # hoặc "asia-southeast1" nếu hỗ trợ

    # Gemini (chỉ dùng cho LLM sinh câu trả lời)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash-lite"

    # Embedding model (local, chạy bằng sentence-transformers)
    EMBEDDING_MODEL: str = "intfloat/multilingual-e5-base"
    EMBEDDING_DIM: int = 768

    # ChromaDB
    CHROMA_HOST: str = "localhost"
    CHROMA_PORT: int = 8001
    CHROMA_COLLECTION: str = "tthc_documents"

    # RAG settings
    RETRIEVAL_TOP_K: int = 10
    RERANKER_TOP_N: int = 3
    SIMILARITY_THRESHOLD: float = 0.5
    # Reranker (cross-encoder, local)
    RERANKER_MODEL: str = "BAAI/bge-reranker-base"
    # Dữ liệu PDF gốc (dùng bổ sung citation - A3.4)
    PDF_DIR: str = "/app/pdf_data"
    PDF_MAX_CHARS: int = 8000

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
