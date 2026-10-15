from datetime import datetime
from sqlalchemy import String, DateTime, Integer, ForeignKey, Text
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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
