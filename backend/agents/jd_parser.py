"""
JD Parser Agent: analyzes job description and computes user match score.
Streams output token by token via an async generator.
"""
from typing import AsyncGenerator, Optional
from langchain_core.messages import HumanMessage, SystemMessage
from backend.agents.state import get_llm
from backend.tools.rag_tool import rag_search

SYSTEM_PROMPT = """你是一位资深技术招聘顾问，擅长解析前端/后端/测试开发岗位的JD。

请对提供的JD进行结构化分析，输出以下内容（使用Markdown格式）：

## 岗位技术栈清单
列出所有技术要求，标注【必选】或【加分项】

## 岗位硬性门槛
工作年限、学历、业务背景等硬性要求

## 用户匹配度分析
（如提供了简历）打分0-100，并说明理由

## 能力差距清单
列出用户需要补强的知识点和项目经验

## 面试考察重点
根据JD预测面试官最可能考察的技术点（优先级排序）

保持分析客观、具体，不做模糊描述。"""


async def run_jd_parser(
    jd_text: str,
    resume_text: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """Yield streamed analysis chunks."""
    llm = get_llm(streaming=True)

    # Optionally enrich with RAG knowledge
    rag_context = rag_search(jd_text[:200], k=2)

    user_content = f"## 目标岗位JD\n{jd_text}"
    if resume_text:
        user_content += f"\n\n## 用户简历\n{resume_text}"
    if rag_context and "暂无" not in rag_context:
        user_content += f"\n\n## 相关技术参考（来自知识库）\n{rag_context}"

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=user_content),
    ]

    async for chunk in llm.astream(messages):
        if chunk.content:
            yield chunk.content
