"""
Study Planner Agent: generates a structured JSON study plan.
If a historical interview report exists, enables weak-point priority mode.
"""
import json
import re
from typing import AsyncGenerator, Optional

from langchain_core.messages import HumanMessage, SystemMessage

from backend.agents.state import get_llm
from backend.tools.rag_tool import rag_search
from backend.tools.report_reader import extract_weak_points

SYSTEM_PROMPT_FRESH = """你是一位经验丰富的技术面试辅导老师。
请根据岗位JD分析结果，生成结构化复习计划。

【重要】只输出合法JSON，不要添加任何前缀、说明文字或Markdown代码块。

输出格式：
{
  "meta": {
    "estimated_hours": "预计复习时长，如'4-6小时'",
    "total_steps": 8
  },
  "steps": [
    {
      "index": 0,
      "category": "知识点",
      "title": "知识点名称",
      "priority": "高",
      "difficulty": 3,
      "is_weakness": false,
      "why_important": "一句话说明为什么这个知识点在面试中重要",
      "key_points": ["核心考点1", "核心考点2", "核心考点3"],
      "resources": ["推荐资料1", "推荐资料2"]
    }
  ]
}

字段约束：
- category 只能是 "知识点" / "算法题型" / "项目方向" 之一
- priority 只能是 "高" / "中" / "低" 之一
- difficulty 为 1-5 整数（5最难）
- is_weakness 无历史记录时始终为 false
- steps 总数 6-12 个，覆盖知识点、算法题型、项目方向三类
- 按 priority 降序排列（高→中→低）
- key_points 每步 3-5 条"""

SYSTEM_PROMPT_WEAKNESS = """你是一位经验丰富的技术面试辅导老师，擅长针对性复习规划。
用户已有历史面试记录，请基于历史薄弱点生成优化后的结构化复习计划。

【重要】只输出合法JSON，不要添加任何前缀、说明文字或Markdown代码块。

输出格式：
{
  "meta": {
    "estimated_hours": "预计复习时长，如'4-6小时'",
    "total_steps": 8
  },
  "steps": [
    {
      "index": 0,
      "category": "知识点",
      "title": "知识点名称",
      "priority": "高",
      "difficulty": 3,
      "is_weakness": true,
      "why_important": "一句话说明为什么这个知识点在面试中重要，并指出历史薄弱原因",
      "key_points": ["核心考点1", "核心考点2", "核心考点3"],
      "resources": ["推荐资料1", "推荐资料2"]
    }
  ]
}

字段约束：
- category 只能是 "知识点" / "算法题型" / "项目方向" 之一
- priority 只能是 "高" / "中" / "低" 之一
- difficulty 为 1-5 整数（5最难）
- is_weakness: 历史薄弱点对应的 step 设为 true，其余为 false
- 历史薄弱点对应的 step 排在最前，priority 设为 "高"
- steps 总数 6-12 个，覆盖知识点、算法题型、项目方向三类
- key_points 每步 3-5 条"""


def _extract_json(text: str) -> dict:
    """Parse JSON from LLM output, stripping any markdown code fences."""
    text = text.strip()
    # Strip ```json ... ``` or ``` ... ```
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\s*```\s*$", "", text, flags=re.MULTILINE)
    return json.loads(text.strip())


async def generate_study_plan(
    jd_analysis: str,
    history_report_json: Optional[str] = None,
) -> dict:
    """Generate and return a structured study plan dict."""
    llm = get_llm(streaming=True)
    has_history = bool(history_report_json)
    system_prompt = SYSTEM_PROMPT_WEAKNESS if has_history else SYSTEM_PROMPT_FRESH

    rag_context = rag_search(jd_analysis[:300], k=3)

    user_content = f"## JD分析结果\n{jd_analysis}"

    if has_history:
        weak_points = extract_weak_points(history_report_json)
        user_content += f"\n\n## 历史面试报告（薄弱点参考）\n{weak_points}"

    if rag_context and "暂无" not in rag_context:
        user_content += f"\n\n## 知识库参考资料\n{rag_context}"

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_content),
    ]

    full_text = ""
    async for chunk in llm.astream(messages):
        if chunk.content:
            full_text += chunk.content

    return _extract_json(full_text)


# Keep the old streaming interface for the router (yields keepalive events + done)
async def run_study_planner(
    jd_analysis: str,
    history_report_json: Optional[str] = None,
) -> AsyncGenerator[dict, None]:
    """Yield SSE-ready dicts: {type: 'generating'} keepalives, then {type: 'done', plan: {...}}."""
    llm = get_llm(streaming=True)
    has_history = bool(history_report_json)
    system_prompt = SYSTEM_PROMPT_WEAKNESS if has_history else SYSTEM_PROMPT_FRESH

    rag_context = rag_search(jd_analysis[:300], k=3)
    user_content = f"## JD分析结果\n{jd_analysis}"

    if has_history:
        weak_points = extract_weak_points(history_report_json)
        user_content += f"\n\n## 历史面试报告（薄弱点参考）\n{weak_points}"

    if rag_context and "暂无" not in rag_context:
        user_content += f"\n\n## 知识库参考资料\n{rag_context}"

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_content),
    ]

    full_text = ""
    chunk_count = 0
    async for chunk in llm.astream(messages):
        if chunk.content:
            full_text += chunk.content
            chunk_count += 1
            if chunk_count % 15 == 0:
                yield {"type": "generating"}

    plan = _extract_json(full_text)
    # Ensure step indices are correct
    for i, step in enumerate(plan.get("steps", [])):
        step["index"] = i
    plan["meta"]["total_steps"] = len(plan.get("steps", []))

    yield {"type": "done", "plan": plan}
