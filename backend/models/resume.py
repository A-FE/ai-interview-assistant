from datetime import datetime
from sqlalchemy import String, DateTime, Integer, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column
from backend.database import Base


class Resume(Base):
    """User-uploaded resume. Raw text extracted locally; LLM summary stored as JSON."""
    __tablename__ = "resumes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    filename: Mapped[str] = mapped_column(String(256))
    raw_text: Mapped[str] = mapped_column(Text, nullable=True)
    # JSON: { name, years_exp, core_skills[], education, summary_text }
    summary: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
