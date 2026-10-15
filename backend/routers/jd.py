import json
from difflib import SequenceMatcher
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models.user import User
from backend.models.jd_session import JDSession
from backend.routers.auth import get_current_user
from backend.schemas import JDAnalyzeRequest, JDSessionResponse, JDOCRRequest
from backend.agents.jd_parser import run_jd_parser, extract_jd_summary
from backend.config import settings

router = APIRouter(prefix="/api/jd", tags=["jd"])

_DEDUP_THRESHOLD = 0.90   # similarity ratio above which we consider two JDs duplicates
_DEDUP_COMPARE_LEN = 2000  # only compare first N chars for performance


def _similarity(a: str, b: str) -> float:
    """Return SequenceMatcher ratio for first _DEDUP_COMPARE_LEN chars of each string."""
    return SequenceMatcher(None, a[:_DEDUP_COMPARE_LEN], b[:_DEDUP_COMPARE_LEN]).ratio()


@router.post("/analyze")
async def analyze_jd(
    body: JDAnalyzeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream JD analysis results via SSE, then persist session + summary.

    Before creating a new session, checks for near-duplicate JDs (similarity > 90%).
    If a duplicate is found, returns an SSE event of type 'duplicate' instead.
    """

    # ── Deduplication check ──────────────────────────────────────────────────
    recent_result = await db.execute(
        select(JDSession)
        .where(JDSession.user_id == current_user.id)
        .order_by(JDSession.created_at.desc())
        .limit(20)
    )
    recent_sessions = recent_result.scalars().all()

    for existing in recent_sessions:
        if _similarity(body.jd_text, existing.jd_text) > _DEDUP_THRESHOLD:
            async def duplicate_stream(eid=existing.id):
                yield f"data: {json.dumps({'type': 'duplicate', 'session_id': eid})}\n\n"
            return StreamingResponse(duplicate_stream(), media_type="text/event-stream")

    # ── Create new session ───────────────────────────────────────────────────
    session = JDSession(
        user_id=current_user.id,
        jd_text=body.jd_text,
        resume_text=body.resume_text,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    async def event_stream():
        yield f"data: {json.dumps({'type': 'session_id', 'session_id': session.id})}\n\n"
        full_result = ""
        async for chunk in run_jd_parser(body.jd_text, body.resume_text):
            full_result += chunk
            yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"

        # Extract structured summary (non-streaming, fast)
        summary_dict = await extract_jd_summary(body.jd_text, full_result, body.resume_text)
        summary_json = json.dumps(summary_dict, ensure_ascii=False)

        session.analysis_result = full_result
        session.jd_summary = summary_json
        # Persist denormalized fields for fast list queries
        session.title = summary_dict.get("title")
        session.company = summary_dict.get("company")
        await db.commit()

        yield f"data: {json.dumps({'type': 'done', 'session_id': session.id, 'jd_summary': summary_dict})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/ocr")
async def ocr_jd_image(
    body: JDOCRRequest,
    current_user: User = Depends(get_current_user),
):
    """Extract JD text from an uploaded screenshot via Vision API,
    then clean and reformat it with a second LLM pass."""
    from openai import AsyncOpenAI

    client = AsyncOpenAI(
        api_key=settings.dashscope_api_key,
        base_url=settings.llm_base_url,
    )

    image_url = f"data:{body.mime_type};base64,{body.image_base64}"

    # ── Step 1: OCR — extract raw text from image ────────────────────────────
    try:
        ocr_response = await client.chat.completions.create(
            model=settings.vision_model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": image_url},
                        },
                        {
                            "type": "text",
                            "text": (
                                "请识别图片中的招聘岗位描述（JD）文字内容，"
                                "原样输出所有文字，保持段落结构，不要添加任何额外内容。"
                                "如果图片不是JD，返回空字符串。"
                            ),
                        },
                    ],
                }
            ],
        )
        raw_text = ocr_response.choices[0].message.content or ""
        raw_text = raw_text.strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR 识别失败：{str(e)}")

    if not raw_text:
        return {"text": ""}

    # ── Step 2: Clean — reformat with text LLM, strip irrelevant content ─────
    try:
        clean_response = await client.chat.completions.create(
            model=settings.llm_model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "你是一个 JD 文本整理助手。"
                        "用户会给你一段从截图 OCR 识别出的招聘 JD 原始文字，其中可能混入了网页导航栏、"
                        "按钮文字、广告、页脚、乱码等无关内容。\n\n"
                        "请完成以下任务：\n"
                        "1. 删除所有与招聘 JD 无关的内容（导航、按钮、广告、公司介绍以外的营销文字等）\n"
                        "2. 修复明显的 OCR 错误（错别字、断行错误等）\n"
                        "3. 整理段落结构，使岗位职责、任职要求等层次清晰\n"
                        "4. 保留所有实质性 JD 内容，不得删减岗位要求\n"
                        "5. 只输出整理后的 JD 文本，不要添加任何解释或前缀"
                    ),
                },
                {
                    "role": "user",
                    "content": f"以下是 OCR 识别出的原始文字：\n\n{raw_text}",
                },
            ],
        )
        cleaned_text = clean_response.choices[0].message.content or raw_text
        cleaned_text = cleaned_text.strip()
    except Exception:
        # If cleaning fails, fall back to raw OCR text
        cleaned_text = raw_text

    return {"text": cleaned_text}


@router.get("/sessions", response_model=list[JDSessionResponse])
async def list_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(JDSession)
        .where(JDSession.user_id == current_user.id)
        .order_by(JDSession.created_at.desc())
    )
    return result.scalars().all()


@router.get("/sessions/{session_id}", response_model=JDSessionResponse)
async def get_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(JDSession).where(
            JDSession.id == session_id,
            JDSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    return session


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a JD session (and cascade-orphan its dependent records)."""
    result = await db.execute(
        select(JDSession).where(
            JDSession.id == session_id,
            JDSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    await db.delete(session)
    await db.commit()
