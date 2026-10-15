import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models.user import User
from backend.models.jd_session import JDSession
from backend.models.interview_session import InterviewSession
from backend.models.report import InterviewReport
from backend.routers.auth import get_current_user
from backend.schemas import InterviewStartRequest, InterviewAnswerRequest, InterviewSessionResponse
from backend.agents.interviewer import run_interviewer_start, run_interviewer_answer
from backend.agents.evaluator import run_evaluator

router = APIRouter(prefix="/api/interview", tags=["interview"])


@router.post("/start", response_model=InterviewSessionResponse)
async def start_interview(
    body: InterviewStartRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new interview session and return the opening question."""
    jd_result = await db.execute(
        select(JDSession).where(
            JDSession.id == body.jd_session_id,
            JDSession.user_id == current_user.id,
        )
    )
    jd_session = jd_result.scalar_one_or_none()
    if not jd_session:
        raise HTTPException(status_code=404, detail="JD会话不存在")

    # Find latest report for weak-point mode
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

    interview = InterviewSession(
        user_id=current_user.id,
        jd_session_id=body.jd_session_id,
        messages="[]",
        code_submissions="[]",
        status="active",
    )
    db.add(interview)
    await db.commit()
    await db.refresh(interview)

    return interview


@router.post("/{interview_id}/answer")
async def answer_question(
    interview_id: int,
    body: InterviewAnswerRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit an answer and stream the interviewer's follow-up via SSE."""
    interview_result = await db.execute(
        select(InterviewSession).where(
            InterviewSession.id == interview_id,
            InterviewSession.user_id == current_user.id,
        )
    )
    interview = interview_result.scalar_one_or_none()
    if not interview:
        raise HTTPException(status_code=404, detail="面试会话不存在")
    if interview.status == "ended":
        raise HTTPException(status_code=400, detail="面试已结束")

    # Load JD info
    jd_result = await db.execute(select(JDSession).where(JDSession.id == interview.jd_session_id))
    jd_session = jd_result.scalar_one_or_none()

    # Fetch latest report for this JD (weak-point context)
    report_result = await db.execute(
        select(InterviewReport)
        .where(
            InterviewReport.user_id == current_user.id,
            InterviewReport.jd_session_id == interview.jd_session_id,
        )
        .order_by(InterviewReport.created_at.desc())
        .limit(1)
    )
    latest_report = report_result.scalar_one_or_none()
    history_report_json = latest_report.report_json if latest_report else None

    messages = json.loads(interview.messages)
    code_submissions = json.loads(interview.code_submissions)

    # Append user message
    messages.append({"role": "user", "content": body.content})
    if body.code:
        code_submissions.append({
            "code": body.code,
            "language": body.language or "python",
            "result": None,  # filled after sandbox run
        })

    async def event_stream():
        ai_reply = ""
        async for chunk in run_interviewer_answer(
            jd_analysis=jd_session.analysis_result or jd_session.jd_text,
            messages=messages,
            user_code=body.code,
            code_language=body.language,
            history_report_json=history_report_json,
        ):
            ai_reply += chunk
            yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"

        # Persist updated conversation
        messages.append({"role": "assistant", "content": ai_reply})
        interview.messages = json.dumps(messages, ensure_ascii=False)
        if body.code and code_submissions:
            code_submissions[-1]["result"] = ai_reply[:200]
        interview.code_submissions = json.dumps(code_submissions, ensure_ascii=False)
        await db.commit()
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/{interview_id}/end")
async def end_interview(
    interview_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """End the interview and trigger evaluation (SSE stream of report generation)."""
    interview_result = await db.execute(
        select(InterviewSession).where(
            InterviewSession.id == interview_id,
            InterviewSession.user_id == current_user.id,
        )
    )
    interview = interview_result.scalar_one_or_none()
    if not interview:
        raise HTTPException(status_code=404, detail="面试会话不存在")

    interview.status = "ended"
    interview.ended_at = datetime.utcnow()
    await db.commit()

    messages = json.loads(interview.messages)
    code_submissions = json.loads(interview.code_submissions)

    async def event_stream():
        report_text = ""
        async for chunk in run_evaluator(
            messages=messages,
            code_submissions=code_submissions,
        ):
            report_text += chunk
            yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"

        # Parse overall score from report (best-effort)
        import re
        score_match = re.search(r"总分[：:]\s*(\d+)", report_text)
        overall_score = float(score_match.group(1)) if score_match else None

        # Extract weak points summary
        weak_match = re.search(r"薄弱知识点[^：:]*[：:](.*?)(?:\n|$)", report_text)
        weak_summary = weak_match.group(1).strip() if weak_match else None

        report = InterviewReport(
            user_id=current_user.id,
            jd_session_id=interview.jd_session_id,
            interview_session_id=interview_id,
            overall_score=overall_score,
            report_json=report_text,
            weak_points_summary=weak_summary,
        )
        db.add(report)
        await db.commit()
        await db.refresh(report)
        yield f"data: {json.dumps({'type': 'done', 'report_id': report.id})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/{interview_id}/opening")
async def get_opening_question(
    interview_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream the interviewer's first question for a newly created session."""
    interview_result = await db.execute(
        select(InterviewSession).where(
            InterviewSession.id == interview_id,
            InterviewSession.user_id == current_user.id,
        )
    )
    interview = interview_result.scalar_one_or_none()
    if not interview:
        raise HTTPException(status_code=404, detail="面试会话不存在")

    jd_result = await db.execute(select(JDSession).where(JDSession.id == interview.jd_session_id))
    jd_session = jd_result.scalar_one_or_none()

    report_result = await db.execute(
        select(InterviewReport)
        .where(
            InterviewReport.user_id == current_user.id,
            InterviewReport.jd_session_id == interview.jd_session_id,
        )
        .order_by(InterviewReport.created_at.desc())
        .limit(1)
    )
    latest_report = report_result.scalar_one_or_none()
    history_report_json = latest_report.report_json if latest_report else None

    async def event_stream():
        opening = ""
        async for chunk in run_interviewer_start(
            jd_analysis=jd_session.analysis_result or jd_session.jd_text,
            history_report_json=history_report_json,
        ):
            opening += chunk
            yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"

        messages = [{"role": "assistant", "content": opening}]
        interview.messages = json.dumps(messages, ensure_ascii=False)
        await db.commit()
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
