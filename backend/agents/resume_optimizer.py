"""
Resume Optimizer Agent: rewrites resume project descriptions to align with JD keywords.
"""
from typing import AsyncGenerator
from langchain_core.messages import HumanMessage, SystemMessage
from backend.agents.state import get_llm

SYSTEM_PROMPT = """你是一位专业的简历优化顾问，擅长帮助程序员针对目标岗位优化简历。

请根据提供的JD和用户简历，输出以下内容（Markdown格式）：

## 简历整体评估
（与JD的契合度、主要问题）

## 项目经历优化建议
（逐项给出具体的改写建议，对齐JD技术关键词，量化项目成果）

## 技能描述优化
（如何更好地展示与JD匹配的技术栈）

## 表述问题指出
（指出过于模糊、空洞的描述，给出改进示例）

## 优化后示例片段
（选取1-2个项目描述，给出优化前→优化后的对比示例）

建议要具体可执行，优化后的表述要自然专业，不过度堆砌关键词。"""


async def run_resume_optimizer(
    jd_text: str,
    resume_text: str,
) -> AsyncGenerator[str, None]:
    """Yield streamed resume optimization suggestions."""
    llm = get_llm(streaming=True)

    user_content = (
        f"## 目标岗位JD\n{jd_text}\n\n"
        f"## 用户简历\n{resume_text}\n\n"
        "请对简历进行针对性优化分析。"
    )

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=user_content),
    ]

    async for chunk in llm.astream(messages):
        if chunk.content:
            yield chunk.content
