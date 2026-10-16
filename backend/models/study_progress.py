from datetime import datetime
from sqlalchemy import String, DateTime, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from backend.database import Base


class StudyStepProgress(Base):
    """Tracks per-step learning status for a user's study plan."""
    __tablename__ = "study_step_progress"
    __table_args__ = (
        UniqueConstraint("user_id", "jd_session_id", "step_index", name="uq_user_jd_step"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    jd_session_id: Mapped[int] = mapped_column(Integer, ForeignKey("jd_sessions.id"), index=True)
    step_index: Mapped[int] = mapped_column(Integer)
    # "pending" | "mastered" | "needs_review" | "skipped"
    status: Mapped[str] = mapped_column(String(20), default="pending")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
