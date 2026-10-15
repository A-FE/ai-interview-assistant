from datetime import datetime
from sqlalchemy import String, DateTime, Integer, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column
from backend.database import Base


class InterviewSession(Base):
    """One record per mock interview session."""
    __tablename__ = "interview_sessions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    jd_session_id: Mapped[int] = mapped_column(Integer, ForeignKey("jd_sessions.id"), index=True)
    # Full conversation history as JSON list
    messages: Mapped[str] = mapped_column(Text, default="[]")
    # Code submissions as JSON list of {question, code, language, result}
    code_submissions: Mapped[str] = mapped_column(Text, default="[]")
    status: Mapped[str] = mapped_column(String(20), default="active")  # active | ended
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    ended_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
