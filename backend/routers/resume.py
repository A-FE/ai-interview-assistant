import json
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models.user import User
from backend.routers.auth import get_current_user
from backend.schemas import ResumeOptimizeRequest
from backend.agents.resume_optimizer import run_resume_optimizer

router = APIRouter(prefix="/api/resume", tags=["resume"])


@router.post("/optimize")
async def optimize_resume(
    body: ResumeOptimizeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream resume optimization suggestions via SSE."""

    async def event_stream():
        async for chunk in run_resume_optimizer(
            jd_text=body.jd_text,
            resume_text=body.resume_text,
        ):
            yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
