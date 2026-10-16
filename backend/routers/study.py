import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models.user import User
from backend.models.jd_session import JDSession
from backend.models.report import InterviewReport
from backend.models.study_progress import StudyStepProgress
from backend.routers.auth import get_current_user
from backend.schemas import StudyPlanRequest, StudyProgressUpdateRequest, StudyStepProgressResponse
from backend.agents.study_planner import run_study_planner

router = APIRouter(prefix="/api/study", tags=["study"])

_VALID_STATUSES = {"pending", "mastered", "needs_review", "skipped"}


@router.post("/plan")
async def get_study_plan(
    body: StudyPlanRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream structured study plan (JSON).

    SSE events:
      {type: 'generating'}          — keepalive while LLM runs
      {type: 'done', plan: {...}, cached: bool}  — final structured plan
    """
    jd_result = await db.execute(
        select(JDSession).where(
            JDSession.id == body.jd_session_id,
            JDSession.user_id == current_user.id,
        )
    )
    jd_session = jd_result.scalar_one_or_none()
    if not jd_session:
        raise HTTPException(status_code=404, detail="JD会话不存在")

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

    # ── Cache hit ────────────────────────────────────────────────────────────
    if jd_session.study_plan_cache and not body.force_refresh:
        try:
            cached_plan = json.loads(jd_session.study_plan_cache)
        except (json.JSONDecodeError, ValueError):
            cached_plan = None

        if cached_plan is not None:
            async def cached_stream():
                yield f"data: {json.dumps({'type': 'done', 'plan': cached_plan, 'cached': True}, ensure_ascii=False)}\n\n"

            return StreamingResponse(cached_stream(), media_type="text/event-stream")

    # ── Generate, cache, stream ──────────────────────────────────────────────
    async def generate_stream():
        plan = None
        async for event in run_study_planner(
            jd_analysis=jd_session.analysis_result or jd_session.jd_text,
            history_report_json=history_report_json,
        ):
            if event["type"] == "generating":
                yield f"data: {json.dumps({'type': 'generating'})}\n\n"
            elif event["type"] == "done":
                plan = event["plan"]

        if plan is not None:
            jd_session.study_plan_cache = json.dumps(plan, ensure_ascii=False)
            await db.commit()
            yield f"data: {json.dumps({'type': 'done', 'plan': plan, 'cached': False}, ensure_ascii=False)}\n\n"

    return StreamingResponse(generate_stream(), media_type="text/event-stream")


@router.get("/{jd_session_id}/progress", response_model=list[StudyStepProgressResponse])
async def get_progress(
    jd_session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all step-progress records for this user + JD session."""
    result = await db.execute(
        select(StudyStepProgress).where(
            StudyStepProgress.user_id == current_user.id,
            StudyStepProgress.jd_session_id == jd_session_id,
        )
    )
    rows = result.scalars().all()
    return rows


@router.put("/{jd_session_id}/progress")
async def update_progress(
    jd_session_id: int,
    body: StudyProgressUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upsert a single step's status."""
    if body.status not in _VALID_STATUSES:
        raise HTTPException(status_code=422, detail=f"status 必须是 {_VALID_STATUSES} 之一")

    stmt = (
        sqlite_insert(StudyStepProgress)
        .values(
            user_id=current_user.id,
            jd_session_id=jd_session_id,
            step_index=body.step_index,
            status=body.status,
        )
        .on_conflict_do_update(
            index_elements=["user_id", "jd_session_id", "step_index"],
            set_={"status": body.status},
        )
    )
    await db.execute(stmt)
    await db.commit()
    return {"ok": True}
