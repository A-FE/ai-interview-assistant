"""
Evaluator Agent: generates a structured interview evaluation report.
"""
from typing import AsyncGenerator
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from backend.agents.state import get_llm

SYSTEM_PROMPT = """你是一位专业的技术面试评估官。请根据完整的面试对话记录和代码提交结果，生成一份结构化面试评估报告（Markdown格式）。

报告必须包含以下章节：

# 面试评估报告

## 总分：XX/100

## 分项评分
- 理论基础：XX/25
- 代码编写：XX/25
- 问题分析：XX/25
- 表达能力：XX/25

## 各题点评
（逐题分析，包括：回答优点、缺失要点、改进建议）

## 薄弱知识点汇总
（用逗号分隔的知识点列表，便于后续系统读取）

## 后续复习建议
（针对薄弱点的具体建议）

## 总体评价
（综合面试表现的简短总结）

评估要客观公正，点评要具体，不做模糊描述。薄弱知识点汇总必须格式化为逗号分隔的关键词，方便系统解析。"""


async def run_evaluator(
    messages: list[dict],
    code_submissions: list[dict],
) -> AsyncGenerator[str, None]:
    """Stream evaluation report chunks."""
    llm = get_llm(streaming=True)

    # Format conversation history
    conversation = "\n".join(
        f"{'面试官' if m['role'] == 'assistant' else '候选人'}: {m['content']}"
        for m in messages
    )

    user_content = f"## 完整面试对话记录\n{conversation}"

    if code_submissions:
        user_content += "\n\n## 代码提交记录\n"
        for i, sub in enumerate(code_submissions, 1):
            user_content += (
                f"\n### 代码题{i}（{sub.get('language', 'python')}）\n"
                f"```{sub.get('language', 'python')}\n{sub.get('code', '')}\n```\n"
            )
            if sub.get("result"):
                user_content += f"运行结果摘要：{sub['result']}\n"

    user_content += "\n\n请生成完整的面试评估报告。"

    lc_messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=user_content),
    ]

    async for chunk in llm.astream(lc_messages):
        if chunk.content:
            yield chunk.content
