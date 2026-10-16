"""
Resume router: upload PDF/Word, extract text locally, summarize with LLM in background.
"""
import io
import json
import logging
import time
import urllib.parse
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from backend.database import get_db, AsyncSessionLocal
from backend.models.user import User
from backend.models.resume import Resume
from backend.routers.auth import get_current_user
from backend.schemas import ResumeResponse
from backend.agents.state import get_llm
from langchain_core.messages import HumanMessage, SystemMessage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/resume", tags=["resume"])

ALLOWED_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
}

SUMMARY_SYSTEM = """你是一个简历信息提取助手。从简历文本中提取全部关键信息，以 JSON 格式返回，不要任何其他内容。

JSON 格式：
{
  "name": "姓名（字符串，不确定则 null）",
  "years_exp": "工作年限（字符串，如 3年，不确定则 null）",
  "current_title": "当前或最近职位名称（字符串，不确定则 null）",
  "core_skills": ["技能1", "技能2"],
  "education": "最高学历（字符串，如 本科·计算机，不确定则 null）",
  "summary_text": "个人综合简介，概括背景、专长和亮点（100字以内）",
  "work_experience": [
    {
      "company": "公司名",
      "title": "职位",
      "duration": "时间段，如 2021.03 - 2023.06",
      "highlights": ["核心职责或成就1（保留原文关键数据）", "核心职责或成就2"]
    }
  ],
  "projects": [
    {
      "name": "项目名称",
      "role": "担任角色",
      "tech_stack": ["技术1", "技术2"],
      "description": "项目简介（50字以内）"
    }
  ],
  "certifications": ["证书1"]
}

工作经历提取规则（严格遵守）：
1. 先识别简历中全部公司及其在职时间段（公司列表通常在简历开头或侧边栏）
2. 简历正文中的每条内容（项目、职责、成就），根据其标注的时间段归属到时间范围匹配的公司
   - 例如：某项目标注 2022.04-2025.09，而某公司在职期间是 2021.04-2026.04，则该项目归属该公司
3. 没有明确时间标注的内容，根据其在文中出现的位置（紧跟哪家公司之后）归属
4. 每家公司必须单独一个条目，不得合并，不得遗漏
5. highlights 只放该公司时间范围内的内容，不要把其他公司的内容混入

其他规则：
- projects 只提取有明确项目名称的条目
- certifications 没有则返回空数组
- 只输出 JSON，不要 markdown 代码块，不要任何解释"""


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
    """Extract text from .docx bytes using python-docx.

    Iterates document body children in order so that table cells and
    paragraphs are interleaved in the same sequence as they appear on
    the page, preserving all content.
    """
    import docx
    from docx.oxml.ns import qn

    doc = docx.Document(io.BytesIO(data))
    parts: list[str] = []

    def _iter_block_items(parent):
        """Yield paragraphs and tables in document order."""
        for child in parent.element.body:
            tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
            if tag == "p":
                para = docx.text.paragraph.Paragraph(child, parent)
                text = para.text.strip()
                if text:
                    parts.append(text)
            elif tag == "tbl":
                table = docx.table.Table(child, parent)
                for row in table.rows:
                    row_cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                    if row_cells:
                        parts.append("  ".join(row_cells))

    _iter_block_items(doc)
    return "\n".join(parts)


async def _summarize_resume(raw_text: str) -> dict:
    """Call LLM to extract structured summary. Returns dict.

    Disables Qwen3 thinking mode via extra_body for fast structured extraction.
    """
    logger.info("[resume] LLM 摘要提取开始，原文长度=%d chars", len(raw_text))
    t0 = time.monotonic()
    # Disable Qwen3 extended thinking — reduces latency from ~90s to ~5s
    llm = get_llm(streaming=False)
    llm.temperature = 0
    messages = [
        SystemMessage(content=SUMMARY_SYSTEM),
        HumanMessage(content=f"## 简历文本\n{raw_text}"),
    ]
    try:
        resp = await llm.ainvoke(messages, extra_body={"enable_thinking": False})
        elapsed = time.monotonic() - t0
        logger.info("[resume] LLM 摘要提取完成，耗时=%.2fs，响应长度=%d chars", elapsed, len(resp.content))
        raw = resp.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)
    except Exception as e:
        elapsed = time.monotonic() - t0
        logger.warning("[resume] LLM 摘要提取失败，耗时=%.2fs，错误=%s", elapsed, e)
        return {}


async def _run_summarize_background(resume_id: int, raw_text: str) -> None:
    """Background task: call LLM, write summary back to DB."""
    async with AsyncSessionLocal() as db:
        try:
            summary_dict = await _summarize_resume(raw_text)
            result = await db.execute(select(Resume).where(Resume.id == resume_id))
            resume = result.scalar_one_or_none()
            if resume:
                resume.summary = json.dumps(summary_dict, ensure_ascii=False)
                resume.status = "done" if summary_dict else "failed"
                await db.commit()
                logger.info("[resume] 后台摘要写入完成：resume_id=%s, status=%s", resume_id, resume.status)
        except Exception as e:
            logger.error("[resume] 后台摘要任务异常：resume_id=%s, error=%s", resume_id, e, exc_info=True)
            try:
                result = await db.execute(select(Resume).where(Resume.id == resume_id))
                resume = result.scalar_one_or_none()
                if resume:
                    resume.status = "failed"
                    await db.commit()
            except Exception:
                pass


@router.post("/upload", response_model=ResumeResponse)
async def upload_resume(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a PDF or Word resume, extract text, kick off LLM summary in background."""
    t_start = time.monotonic()
    content_type = file.content_type or ""
    filename = file.filename or "resume"
    logger.info("[resume] 收到上传请求：user_id=%s, filename=%s, content_type=%s",
                current_user.id, filename, content_type)

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
    logger.info("[resume] 文件读取完成：size=%d bytes (%.1f KB)", len(data), len(data) / 1024)

    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="文件大小不能超过 10 MB")

    try:
        t1 = time.monotonic()
        raw_text = _extract_text_pdf(data) if is_pdf else _extract_text_docx(data)
        logger.info("[resume] 文本提取完成：耗时=%.2fs，字符数=%d", time.monotonic() - t1, len(raw_text))
    except Exception as e:
        logger.error("[resume] 文本提取失败：%s", e, exc_info=True)
        raise HTTPException(status_code=422, detail=f"文件解析失败：{str(e)}")

    if not raw_text.strip():
        raise HTTPException(status_code=422, detail="文件中未能提取到文字内容（可能是扫描版 PDF）")

    stored_ct = "application/pdf" if is_pdf else (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        if filename.lower().endswith(".docx") else "application/msword"
    )

    # Delete all existing resumes for this user before saving the new one
    result = await db.execute(select(Resume).where(Resume.user_id == current_user.id))
    old_resumes = result.scalars().all()
    if old_resumes:
        for old_resume in old_resumes:
            await db.delete(old_resume)
        await db.commit()
        logger.info("[resume] 已删除用户 %s 的 %d 份旧简历", current_user.id, len(old_resumes))

    # Save immediately with status="parsing", return to frontend right away
    resume = Resume(
        user_id=current_user.id,
        filename=filename,
        file_data=data,
        content_type=stored_ct,
        raw_text=raw_text,
        summary=None,
        status="parsing",
    )
    db.add(resume)
    await db.commit()
    await db.refresh(resume)
    logger.info("[resume] 简历已保存（status=parsing），resume_id=%s，耗时=%.2fs",
                resume.id, time.monotonic() - t_start)

    # LLM summarization runs in background after response is sent
    background_tasks.add_task(_run_summarize_background, resume.id, raw_text)
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


@router.get("/{resume_id}/download")
async def download_resume(
    resume_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Download the original uploaded resume file."""
    result = await db.execute(
        select(Resume).where(
            Resume.id == resume_id,
            Resume.user_id == current_user.id,
        )
    )
    resume = result.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=404, detail="简历不存在")
    if not resume.file_data:
        raise HTTPException(status_code=404, detail="原始文件不存在（该简历在功能上线前上传）")

    ct = resume.content_type or "application/octet-stream"
    encoded_name = urllib.parse.quote(resume.filename, safe="")
    content_disposition = f"attachment; filename*=UTF-8''{encoded_name}"
    return StreamingResponse(
        io.BytesIO(resume.file_data),
        media_type=ct,
        headers={"Content-Disposition": content_disposition},
    )


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
