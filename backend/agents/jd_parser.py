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

SYSTEM_PROMPT = """你是一位资深技术招聘顾问，擅长解析前端/后端/测试开发岗位的JD，帮助求职者找到自身与岗位的差距。

请对提供的JD和用户简历进行结构化分析，**以差距为核心**，输出以下内容（使用Markdown格式）：

## ⚠️ 能力差距清单（重点）
**这是最重要的部分。** 详细列出用户目前不满足或需要补强的每一项要求：
- 缺失的技术技能（每条注明优先级：高/中/低）
- 项目经验上的空缺（JD 要求有但简历中没有的方向）
- 硬性门槛上的差距（年限、学历等）
- 每条差距后给出 1-2 句具体的提升建议

## 面试高频考察点
根据 JD 预测面试官最可能考察的技术点（按优先级排序），重点标注用户薄弱的考点

## 岗位硬性门槛
工作年限、学历、业务背景等硬性要求（简洁列出）

## ✅ 已符合的要求（简述）
一笔带过用户简历中已匹配的技能和经验，无需展开说明

## 匹配度评分
给出 0-100 分及一句话总结理由

保持分析客观、具体，不做模糊描述。差距部分务必具体到知识点，不要泛泛而谈。"""

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

    # Disable Qwen3 extended thinking — without this the model ignores resume content
    async for chunk in llm.astream(messages, extra_body={"enable_thinking": False}):
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
