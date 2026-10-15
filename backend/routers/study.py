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


async def _build_study_plan(
    jd_session: JDSession,
    history_report_json: str | None,
) -> str:
    """Run the planner and return the full plan text."""
    chunks = []
    async for chunk in run_study_planner(
        jd_analysis=jd_session.analysis_result or jd_session.jd_text,
        history_report_json=history_report_json,
    ):
        chunks.append(chunk)
    return "".join(chunks)


@router.post("/plan")
async def get_study_plan(
    body: StudyPlanRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream personalized study plan.

    - Returns cached plan immediately if one exists and force_refresh is False.
    - Otherwise generates a new plan, caches it, then streams it.
    """
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

    force_refresh = getattr(body, "force_refresh", False)

    # ── Cache hit: stream cached content directly ────────────────────────────
    if jd_session.study_plan_cache and not force_refresh:
        cached = jd_session.study_plan_cache

        async def cached_stream():
            # Yield in ~256-char chunks to keep the SSE feel
            chunk_size = 256
            for i in range(0, len(cached), chunk_size):
                yield f"data: {json.dumps({'type': 'chunk', 'content': cached[i:i+chunk_size], 'cached': True})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'cached': True})}\n\n"

        return StreamingResponse(cached_stream(), media_type="text/event-stream")

    # ── Cache miss (or force refresh): generate, cache, stream ──────────────
    async def generate_stream():
        full_plan = ""
        async for chunk in run_study_planner(
            jd_analysis=jd_session.analysis_result or jd_session.jd_text,
            history_report_json=history_report_json,
        ):
            full_plan += chunk
            yield f"data: {json.dumps({'type': 'chunk', 'content': chunk, 'cached': False})}\n\n"

        # Persist cache
        jd_session.study_plan_cache = full_plan
        await db.commit()
        yield f"data: {json.dumps({'type': 'done', 'cached': False})}\n\n"

    return StreamingResponse(generate_stream(), media_type="text/event-stream")
