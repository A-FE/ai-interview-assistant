"""
Resume router: upload PDF/Word, extract text locally, summarize with LLM.
"""
import io
import json
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models.user import User
from backend.models.resume import Resume
from backend.routers.auth import get_current_user
from backend.schemas import ResumeResponse
from backend.agents.state import get_llm
from langchain_core.messages import HumanMessage, SystemMessage

router = APIRouter(prefix="/api/resume", tags=["resume"])

ALLOWED_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
}

SUMMARY_SYSTEM = """你是一个简历信息提取助手。从简历文本中提取关键信息，以 JSON 格式返回，不要任何其他内容。

JSON 格式：
{
  "name": "姓名（字符串，不确定则 null）",
  "years_exp": "工作年限（字符串，如 3年，不确定则 null）",
  "core_skills": ["技能1", "技能2", "技能3"],
  "education": "最高学历（字符串，如 本科·计算机，不确定则 null）",
  "summary_text": "一句话简介（不超过50字）"
}

只输出 JSON，不要 markdown 代码块，不要任何解释。"""


def _extract_text_pdf(data: bytes) -> str:
    """Extract text from PDF bytes using pypdf."""
    import pypdf
    reader = pypdf.PdfReader(io.BytesIO(data))
    parts = []
    for page in reader.pages:
        t = page.extract_text()
        if t:
            parts.append(t)
    return "\n".join(parts)


def _extract_text_docx(data: bytes) -> str:
    """Extract text from .docx bytes using python-docx."""
    import docx
    doc = docx.Document(io.BytesIO(data))
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())


async def _summarize_resume(raw_text: str) -> dict:
    """Call LLM to extract structured summary. Returns dict."""
    llm = get_llm(streaming=False)
    messages = [
        SystemMessage(content=SUMMARY_SYSTEM),
        HumanMessage(content=f"## 简历文本\n{raw_text[:3000]}"),
    ]
    try:
        resp = await llm.ainvoke(messages)
        raw = resp.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)
    except Exception:
        return {}


@router.post("/upload", response_model=ResumeResponse)
async def upload_resume(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a PDF or Word resume, extract text, and generate LLM summary."""
    content_type = file.content_type or ""
    filename = file.filename or "resume"

    # Accept by content type or extension fallback
    is_pdf = content_type == "application/pdf" or filename.lower().endswith(".pdf")
    is_docx = (
        content_type in (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword",
        )
        or filename.lower().endswith((".docx", ".doc"))
    )

    if not (is_pdf or is_docx):
        raise HTTPException(status_code=400, detail="仅支持 PDF 或 Word 文件（.pdf / .docx）")

    data = await file.read()
    if len(data) > 10 * 1024 * 1024:  # 10 MB limit
        raise HTTPException(status_code=400, detail="文件大小不能超过 10 MB")

    try:
        raw_text = _extract_text_pdf(data) if is_pdf else _extract_text_docx(data)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"文件解析失败：{str(e)}")

    if not raw_text.strip():
        raise HTTPException(status_code=422, detail="文件中未能提取到文字内容（可能是扫描版 PDF）")

    summary_dict = await _summarize_resume(raw_text)

    resume = Resume(
        user_id=current_user.id,
        filename=filename,
        raw_text=raw_text,
        summary=json.dumps(summary_dict, ensure_ascii=False),
    )
    db.add(resume)
    await db.commit()
    await db.refresh(resume)
    return resume


@router.get("/list", response_model=list[ResumeResponse])
async def list_resumes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Resume)
        .where(Resume.user_id == current_user.id)
        .order_by(Resume.created_at.desc())
    )
    return result.scalars().all()


@router.delete("/{resume_id}", status_code=204)
async def delete_resume(
    resume_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Resume).where(
            Resume.id == resume_id,
            Resume.user_id == current_user.id,
        )
    )
    resume = result.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=404, detail="简历不存在")
    await db.delete(resume)
    await db.commit()
