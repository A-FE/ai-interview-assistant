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
    return {"status": "ok", "service": "JobPrep Agent"}
