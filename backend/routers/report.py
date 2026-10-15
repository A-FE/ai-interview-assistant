from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models.user import User
from backend.models.report import InterviewReport
from backend.routers.auth import get_current_user
from backend.schemas import ReportResponse

router = APIRouter(prefix="/api/report", tags=["report"])


@router.get("/list", response_model=list[ReportResponse])
async def list_reports(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InterviewReport)
        .where(InterviewReport.user_id == current_user.id)
        .order_by(InterviewReport.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{report_id}", response_model=ReportResponse)
async def get_report(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InterviewReport).where(
            InterviewReport.id == report_id,
            InterviewReport.user_id == current_user.id,
        )
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")
    return report


@router.get("/by-jd/{jd_session_id}", response_model=list[ReportResponse])
async def list_reports_by_jd(
    jd_session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InterviewReport)
        .where(
            InterviewReport.user_id == current_user.id,
            InterviewReport.jd_session_id == jd_session_id,
        )
        .order_by(InterviewReport.created_at.desc())
    )
    return result.scalars().all()
