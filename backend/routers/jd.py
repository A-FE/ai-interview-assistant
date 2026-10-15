import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models.user import User
from backend.models.jd_session import JDSession
from backend.routers.auth import get_current_user
from backend.schemas import JDAnalyzeRequest, JDSessionResponse
from backend.agents.jd_parser import run_jd_parser

router = APIRouter(prefix="/api/jd", tags=["jd"])


@router.post("/analyze")
async def analyze_jd(
    body: JDAnalyzeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream JD analysis results via SSE, then persist the session."""

    # Create session record immediately so client gets an ID early
    session = JDSession(
        user_id=current_user.id,
        jd_text=body.jd_text,
        resume_text=body.resume_text,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    async def event_stream():
        yield f"data: {json.dumps({'type': 'session_id', 'session_id': session.id})}\n\n"
        full_result = ""
        async for chunk in run_jd_parser(body.jd_text, body.resume_text):
            full_result += chunk
            yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"

        # Persist final result
        session.analysis_result = full_result
        await db.commit()
        yield f"data: {json.dumps({'type': 'done', 'session_id': session.id})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/sessions", response_model=list[JDSessionResponse])
async def list_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(JDSession)
        .where(JDSession.user_id == current_user.id)
        .order_by(JDSession.created_at.desc())
    )
    return result.scalars().all()


@router.get("/sessions/{session_id}", response_model=JDSessionResponse)
async def get_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(JDSession).where(
            JDSession.id == session_id,
            JDSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    return session
