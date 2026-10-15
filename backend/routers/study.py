import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models.user import User
from backend.models.jd_session import JDSession
from backend.models.report import InterviewReport
from backend.routers.auth import get_current_user
from backend.schemas import StudyPlanRequest
from backend.agents.study_planner import run_study_planner

router = APIRouter(prefix="/api/study", tags=["study"])


@router.post("/plan")
async def get_study_plan(
    body: StudyPlanRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream personalized study plan. Uses historical weak points if a past report exists."""

    # Fetch JD session
    jd_result = await db.execute(
        select(JDSession).where(
            JDSession.id == body.jd_session_id,
            JDSession.user_id == current_user.id,
        )
    )
    jd_session = jd_result.scalar_one_or_none()
    if not jd_session:
        raise HTTPException(status_code=404, detail="JD会话不存在")

    # Find the most recent report for this JD (if any)
    report_result = await db.execute(
        select(InterviewReport)
        .where(
            InterviewReport.user_id == current_user.id,
            InterviewReport.jd_session_id == body.jd_session_id,
        )
        .order_by(InterviewReport.created_at.desc())
        .limit(1)
    )
    latest_report = report_result.scalar_one_or_none()
    history_report_json = latest_report.report_json if latest_report else None

    async def event_stream():
        async for chunk in run_study_planner(
            jd_analysis=jd_session.analysis_result or jd_session.jd_text,
            history_report_json=history_report_json,
        ):
            yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
