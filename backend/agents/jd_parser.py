"""
JD Parser Agent: analyzes job description and computes user match score.
Streams output token by token via an async generator.
After streaming completes, extracts a structured summary via a second LLM call.
"""
import json
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

SUMMARY_SYSTEM = """你是一个信息提取助手。从 JD 文本和分析结果中提取关键信息，以 JSON 格式返回，不要有任何其他内容。

JSON 格式：
{
  "title": "岗位名称（字符串）",
  "company": "公司名称（字符串，不确定则 null）",
  "core_stack": ["技术1", "技术2", "技术3"],
  "level": "经验要求（如 3-5年，不确定则 null）",
  "salary": "薪资范围（如 20-35k·13薪，不确定则 null）",
  "city": "工作城市（如 北京，不确定则 null）",
  "education": "学历要求（如 本科及以上，不确定则 null）",
  "match_score": 匹配分数整数0-100（无简历则 null）
}

只输出 JSON，不要 markdown 代码块，不要任何解释。"""


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


async def extract_jd_summary(jd_text: str, analysis_result: str, resume_text: Optional[str] = None) -> dict:
    """Extract structured summary from JD + analysis. Returns a dict."""
    llm = get_llm(streaming=False)

    user_content = f"## JD原文\n{jd_text[:1000]}\n\n## 分析结果（摘录）\n{analysis_result[:1500]}"
    if resume_text:
        user_content += f"\n\n（用户有提交简历）"

    messages = [
        SystemMessage(content=SUMMARY_SYSTEM),
        HumanMessage(content=user_content),
    ]

    try:
        resp = await llm.ainvoke(messages)
        raw = resp.content.strip()
        # Strip markdown code fences if model wraps them
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)
    except Exception:
        return {}
