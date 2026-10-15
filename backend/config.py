import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # LLM
    dashscope_api_key: str = ""
    llm_base_url: str = "https://llm-axtdj52skmowrf1g.cn-beijing.maas.aliyuncs.com/compatible-mode/v1"
    llm_model: str = "qwen3.8-max"

    # JWT
    secret_key: str = "jobprep-secret-change-in-prod"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    # DB
    database_url: str = "sqlite+aiosqlite:///./jobprep.db"

    # RAG
    chroma_persist_dir: str = "./chroma_db"
    chroma_collection: str = "interview_kb"

    # Code sandbox
    sandbox_timeout_seconds: int = 10
    sandbox_max_memory_mb: int = 128

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
