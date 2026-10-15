from datetime import datetime
from sqlalchemy import String, DateTime, Integer, ForeignKey, Text, LargeBinary
from sqlalchemy.orm import Mapped, mapped_column
from backend.database import Base


class Resume(Base):
    """User-uploaded resume. Raw text extracted locally; LLM summary stored as JSON."""
    __tablename__ = "resumes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    filename: Mapped[str] = mapped_column(String(256))
    file_data: Mapped[bytes] = mapped_column(LargeBinary, nullable=True)   # original file bytes
    content_type: Mapped[str] = mapped_column(String(128), nullable=True)  # MIME type for download
    raw_text: Mapped[str] = mapped_column(Text, nullable=True)
    # JSON: { name, years_exp, core_skills[], education, summary_text,
    #         work_experience[], projects[], certifications[] }
    summary: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
