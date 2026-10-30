"""Seed default JD for new users to enable quick onboarding."""
import json
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.models.jd_session import JDSession
from backend.agents.jd_parser import extract_jd_summary

DEFAULT_JD_TEXT = """高级前端开发工程师（远程）
香港 | 5-10年 | 本科 | 40-70K

岗位职责：
1. 主导前端架构设计，制定技术规范，把控代码质量与交付节奏
2. 主导核心模块开发：K 线图、订单簿、实时行情、资产看板
3. 推进 Web3 前端能力建设：钱包连接、链上数据展示（wagmi / ethers.js）
4. 关注并持续优化前端性能（Core Web Vitals）

任职要求：
1. 5 年以上前端经验，精通 React / Next.js、TypeScript 熟练
2. 有 TradingView 图表库和d3.js相关开发经验，具备开发金融图表（K 线图、深度图、交易盘口）或复杂动态交互表的实战案例
3. 熟悉 WebSocket、Socket.io、Server-Sent Events（SSE）等实时通信技术，具备网络异常重连、心跳检测、数据一致性校验等实时通信底层逻辑的开发经验
4. 了解 DeFi 协议机制（AMM、Perps、Lending）
5. 有AI 调用经验，能独立设计 AI 交互流
6. 了解 Web3 前端技术栈
7. 有交易所或金融类产品经验者优先

加分项
1. 良好的英语读写能力
2. 有开源贡献或个人技术影响力"""


async def create_default_jd_for_user(db: AsyncSession, user_id: int) -> JDSession | None:
    """Create a default JD session for the given user if they don't have one yet.

    Args:
        db: Database session
        user_id: User ID to create default JD for

    Returns:
        Created JDSession or None if already exists
    """
    # Check if user already has a default JD
    result = await db.execute(
        select(JDSession).where(
            JDSession.user_id == user_id,
            JDSession.is_default == True
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return None  # Already has default JD

    # Extract basic summary without resume context
    summary_dict = await extract_jd_summary(DEFAULT_JD_TEXT, "", None)
    summary_json = json.dumps(summary_dict, ensure_ascii=False)

    # Create default JD session
    session = JDSession(
        user_id=user_id,
        jd_text=DEFAULT_JD_TEXT,
        jd_summary=summary_json,
        title=summary_dict.get("title"),
        company=summary_dict.get("company"),
        is_default=True,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    return session


async def ensure_all_users_have_default_jd(db: AsyncSession):
    """Ensure all existing users have a default JD session.

    This is called on app startup to backfill default JDs for existing users.
    """
    from backend.models.user import User

    # Get all users
    result = await db.execute(select(User))
    users = result.scalars().all()

    created_count = 0
    for user in users:
        session = await create_default_jd_for_user(db, user.id)
        if session:
            created_count += 1

    return created_count
