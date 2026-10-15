import json
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


@router.post("/analyze")
async def analyze_jd(
    body: JDAnalyzeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream JD analysis results via SSE, then persist session + summary."""

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
        await db.commit()

        yield f"data: {json.dumps({'type': 'done', 'session_id': session.id, 'jd_summary': summary_dict})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/ocr")
async def ocr_jd_image(
    body: JDOCRRequest,
    current_user: User = Depends(get_current_user),
):
    """Extract JD text from an uploaded screenshot via Vision API."""
    from openai import AsyncOpenAI

    client = AsyncOpenAI(
        api_key=settings.dashscope_api_key,
        base_url=settings.llm_base_url,
    )

    image_url = f"data:{body.mime_type};base64,{body.image_base64}"

    try:
        response = await client.chat.completions.create(
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
        text = response.choices[0].message.content or ""
        return {"text": text.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR 识别失败：{str(e)}")


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
