from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.database import init_db, get_db
from backend.routers import auth, jd, study, interview, report, resume, rag

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()

    # Backfill default JDs for existing users in background
    # Don't block startup - this happens when users log in instead
    logger.info("Database initialized. Default JDs will be created when users log in.")

    # 自动初始化 RAG 知识库
    from backend.rag.init_kb import init_knowledge_base, check_kb_exists
    try:
        if not check_kb_exists():
            logger.info("检测到知识库未初始化，开始初始化...")
            init_knowledge_base()
            logger.info("✅ 知识库初始化完成")
        else:
            logger.info("知识库已存在，跳过初始化")
    except Exception as e:
        logger.error(f"知识库初始化失败: {e}")
        logger.warning("应用将继续启动，但 RAG 功能可能不可用")

    yield


app = FastAPI(
    title="AI 面试助手 API",
    description="AI-powered technical interview preparation platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(jd.router)
app.include_router(study.router)
app.include_router(interview.router)
app.include_router(report.router)
app.include_router(resume.router)
app.include_router(rag.router)


@app.get("/health")
async def health():
    from pathlib import Path
    kb_exists = Path(settings.chroma_persist_dir).exists()
    kb_status = "ready" if kb_exists else "initializing"
    return {
        "status": "ok",
        "service": "JobPrep Agent",
        "knowledge_base": kb_status
    }
