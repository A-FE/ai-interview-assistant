from datetime import datetime
from sqlalchemy import String, DateTime, Integer, ForeignKey, Text, Float
from sqlalchemy.orm import Mapped, mapped_column
from backend.database import Base


class InterviewReport(Base):
    """Structured evaluation report, persisted after interview ends."""
    __tablename__ = "interview_reports"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    jd_session_id: Mapped[int] = mapped_column(Integer, ForeignKey("jd_sessions.id"), index=True)
    interview_session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("interview_sessions.id"), unique=True, index=True
    )
    # Overall score 0-100
    overall_score: Mapped[float] = mapped_column(Float, nullable=True)
    # Full structured report as JSON string
    report_json: Mapped[str] = mapped_column(Text)
    # Comma-separated weak knowledge points for quick query
    weak_points_summary: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
