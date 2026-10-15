"""
Study Planner Agent: generates a personalized review plan.
If a historical interview report exists, enables weak-point priority mode.
"""
from typing import AsyncGenerator, Optional
from langchain_core.messages import HumanMessage, SystemMessage
from backend.agents.state import get_llm
from backend.tools.rag_tool import rag_search
from backend.tools.report_reader import extract_weak_points

SYSTEM_PROMPT_FRESH = """你是一位经验丰富的技术面试辅导老师。
请根据岗位JD分析结果，生成一份个性化复习清单（Markdown格式）：

## 优先复习知识点
（按面试考察权重排序，标注预计掌握难度）

## 推荐算法题型
（列出与岗位强相关的算法类型和典型题目）

## 项目深挖方向
（根据岗位要求，建议用户重点准备的项目经验点）

## 参考资料
（来自知识库的推荐学习资源）

清单要具体、可执行，避免泛泛而谈。"""

SYSTEM_PROMPT_WEAKNESS = """你是一位经验丰富的技术面试辅导老师，擅长针对性复习规划。
用户已有历史面试记录，请基于历史薄弱点生成优化后的复习清单（Markdown格式）：

## 📊 历史掌握情况总结
### ✅ 已掌握知识点
（上一轮面试表现良好，本次减少复习权重）
### ⚠️ 历史薄弱知识点
（本次复习重点，请详细列出）

## 🎯 本次优先复习知识点
（以历史薄弱点为核心，按重要性排序）

## 推荐算法题型
（聚焦薄弱知识点对应的算法类型）

## 项目深挖方向
（针对面试中暴露不足的项目经验点）

## 参考资料
（来自知识库的推荐学习资源）

提示文字：本次复习已参考你在此岗位的上一轮模拟面试结果，优先聚焦薄弱点。"""


async def run_study_planner(
    jd_analysis: str,
    history_report_json: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """Yield streamed study plan chunks."""
    llm = get_llm(streaming=True)

    has_history = bool(history_report_json)
    system_prompt = SYSTEM_PROMPT_WEAKNESS if has_history else SYSTEM_PROMPT_FRESH

    # RAG enrichment based on JD
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

    async for chunk in llm.astream(messages):
        if chunk.content:
            yield chunk.content
