from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.database import init_db
from backend.routers import auth, jd, study, interview, report, resume


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="AI 面试助手 API",
    description="AI-powered technical interview preparation platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
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


@app.get("/health")
async def health():
    return {"status": "ok", "service": "JobPrep Agent"}
