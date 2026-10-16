"""
Study Tutor Agent: Socratic-style AI tutor that guides users through a single knowledge point.
"""
from typing import AsyncGenerator
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

from backend.agents.state import get_llm

SYSTEM_PROMPT_TEMPLATE = """你是耐心专业的技术学习导师，采用渐进式脚手架讲解，模仿 Chrome 引导式学习体验，不使用苏格拉底提问法。

学习材料：

- 知识点标题：{title}
- 分类：{category}
- 优先级：{priority}
- 难度：{difficulty}/5
- 为什么重要：{why_important}
- 核心要点列表：
{key_points_text}

引导规则：

1. 首次开场：2～3 句话简要介绍知识点，说明它的价值，然后讲解**第一个核心要点**。
2. 对话推进：一次只聚焦单个核心要点，绝不一次性展示全部要点。
3. 讲解风格：由浅入深，语言通俗简洁；必要时附带简短代码 / 示例辅助理解。
4. ✅ 讲完当前要点后：**做简短的理解深化引导**（用陈述式补充视角、举场景例子，而非开放式提问），之后告知用户当前要点内容已完成，等待用户反馈，用户确认后再讲解下一个要点。
5. 全部要点讲解完毕后，用 2～3 句话做简短小结，梳理已经掌握的内容。
"""


async def run_study_tutor(
    step: dict,
    messages: list[dict],
) -> AsyncGenerator[str, None]:
    """Stream AI tutor response for a study step conversation.

    Args:
        step: StudyStep dict with title, category, priority, difficulty,
              why_important, key_points, is_weakness fields.
        messages: Conversation history [{role: 'user'|'assistant', content: str}].
                  Empty list triggers the opening greeting.
    """
    llm = get_llm(streaming=True)

    key_points = step.get("key_points", [])
    key_points_text = "\n".join(f"  - {p}" for p in key_points)

    system_content = SYSTEM_PROMPT_TEMPLATE.format(
        title=step.get("title", ""),
        category=step.get("category", "知识点"),
        priority=step.get("priority", "中"),
        difficulty=step.get("difficulty", 3),
        why_important=step.get("why_important", ""),
        key_points_text=key_points_text,
    )

    lc_messages: list = [SystemMessage(content=system_content)]

    if not messages:
        # No history: ask AI to open the conversation
        lc_messages.append(
            HumanMessage(content="请开始引导我学习这个知识点。")
        )
    else:
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "user":
                lc_messages.append(HumanMessage(content=content))
            else:
                lc_messages.append(AIMessage(content=content))

    async for chunk in llm.astream(lc_messages):
        if chunk.content:
            yield chunk.content
