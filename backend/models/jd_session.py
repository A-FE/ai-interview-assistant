from datetime import datetime
from sqlalchemy import String, DateTime, Integer, ForeignKey, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from backend.database import Base


class JDSession(Base):
    """One record per JD analysis. Holds parsed results as JSON text."""
    __tablename__ = "jd_sessions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    jd_text: Mapped[str] = mapped_column(Text)
    resume_text: Mapped[str] = mapped_column(Text, nullable=True)
    # Structured analysis result stored as JSON string
    analysis_result: Mapped[str] = mapped_column(Text, nullable=True)
    # Cached study plan (regenerated after each interview)
    study_plan_cache: Mapped[str] = mapped_column(Text, nullable=True)
    # Structured summary extracted at analysis time (JSON)
    jd_summary: Mapped[str] = mapped_column(Text, nullable=True)
    # Denormalized fields from jd_summary for fast list queries
    title: Mapped[str] = mapped_column(String(200), nullable=True, index=True)
    company: Mapped[str] = mapped_column(String(200), nullable=True, index=True)
    # Flag for default/example JD
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
