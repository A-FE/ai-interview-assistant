"""
Interviewer Agent: conducts a multi-round technical mock interview.
Supports two modes:
  - Full mode: no historical report, covers entire JD tech stack
  - Weakness mode: historical report available, prioritizes weak points
"""
from typing import AsyncGenerator, Optional
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from backend.agents.state import get_llm
from backend.tools.rag_tool import rag_search
from backend.tools.report_reader import extract_weak_points
from backend.tools.code_sandbox import execute_code

SYSTEM_PROMPT_FULL = """你是一位中大厂资深技术面试官，风格严谨专业，擅长连环追问。

【核心约束 - 必须严格遵守】
每次回复只能包含一个问题。禁止在同一条消息中提出两个或两个以上的问题。等待用户回答后再提下一个问题。

面试规则：
1. 根据JD技术要求，依次出题：先理论题，再算法/代码题
2. 每次只问一个问题，等待用户回答后再继续
3. 根据用户的回答深入追问（边界条件、时间复杂度、工程优化等）
4. 遇到代码题，清晰描述题目，并在消息末尾加上标记 [CODE_QUESTION] 提示前端展示代码编辑器
5. 如果用户提交了代码，结合运行结果给出专业点评，然后继续追问
6. 题目必须紧扣JD技术栈，不出无关题目
7. 保持面试官语气，不啰嗦语言简练，不过分友好，但也不刁难"""

SYSTEM_PROMPT_WEAKNESS = """你是一位中大厂资深技术面试官，风格严谨专业，擅长针对性考察。

本轮为针对性复习面试，用户有历史面试薄弱点记录。

【核心约束 - 必须严格遵守】
每次回复只能包含一个问题。禁止在同一条消息中提出两个或两个以上的问题。等待用户回答后再提下一个问题。

面试规则：
1. 优先针对历史薄弱知识点出题（占70%），少量穿插已掌握知识点做巩固（占30%）
2. 每次只问一个问题，等待用户回答后再继续
3. 根据用户的回答深入追问，尤其针对薄弱点要追问到位
4. 遇到代码题，清晰描述题目，并在消息末尾加上标记 [CODE_QUESTION]
5. 如果用户提交了代码，结合运行结果给出专业点评
6. 不完全剔除已掌握知识点，防止遗忘
7. 保持面试官语气，不啰嗦语言简练，不过分友好，但也不刁难"""

async def run_interviewer_start(
    jd_analysis: str,
    history_report_json: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """Stream the opening question."""
    llm = get_llm(streaming=True)
    has_history = bool(history_report_json)
    system_prompt = SYSTEM_PROMPT_WEAKNESS if has_history else SYSTEM_PROMPT_FULL

    user_content = f"## 岗位JD分析\n{jd_analysis}\n\n请开始面试，先做简单的自我介绍要求，然后提出第一个技术问题。"

    if has_history:
        weak_points = extract_weak_points(history_report_json)
        user_content += f"\n\n## 历史薄弱知识点（优先考察）\n{weak_points}"

    # Enrich with RAG knowledge based on JD keywords
    rag_context = rag_search(jd_analysis[:300], k=3)
    if rag_context and "暂无" not in rag_context and "失败" not in rag_context:
        user_content += f"\n\n## 相关技术知识参考（来自知识库，可据此出题）\n{rag_context}"

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_content),
    ]

    async for chunk in llm.astream(messages):
        if chunk.content:
            yield chunk.content


async def run_interviewer_answer(
    jd_analysis: str,
    messages: list[dict],
    user_code: Optional[str] = None,
    code_language: Optional[str] = None,
    history_report_json: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """Stream the interviewer's response to a user answer."""
    llm = get_llm(streaming=True)
    has_history = bool(history_report_json)
    system_prompt = SYSTEM_PROMPT_WEAKNESS if has_history else SYSTEM_PROMPT_FULL

    lc_messages = [SystemMessage(content=system_prompt)]

    # Inject context into first message
    context = f"## 岗位JD分析\n{jd_analysis}"
    if has_history:
        weak_points = extract_weak_points(history_report_json)
        context += f"\n\n## 历史薄弱知识点\n{weak_points}"

    # RAG: query based on the latest user message for targeted knowledge retrieval
    last_user_msg = ""
    for msg in reversed(messages):
        if msg.get("role") == "user":
            last_user_msg = msg.get("content", "")
            break
    rag_query = (last_user_msg or jd_analysis)[:300]
    rag_context = rag_search(rag_query, k=3)
    if rag_context and "暂无" not in rag_context and "失败" not in rag_context:
        context += f"\n\n## 知识库参考资料（可据此追问或点评）\n{rag_context}"

    lc_messages.append(SystemMessage(content=context))

    # Convert stored messages to LangChain message objects
    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role == "assistant":
            lc_messages.append(AIMessage(content=content))
        else:
            lc_messages.append(HumanMessage(content=content))

    # If code was submitted, run sandbox and append result
    if user_code:
        lang = code_language or "python"
        sandbox_result = execute_code(user_code, lang)
        code_feedback = (
            f"\n\n[代码沙箱运行结果]\n"
            f"- 状态: {'✅ 通过' if sandbox_result['success'] else '❌ 失败'}\n"
            f"- 得分: {sandbox_result['score']}/100\n"
            f"- 输出: {sandbox_result['stdout'][:500]}\n"
        )
        if sandbox_result['stderr']:
            code_feedback += f"- 错误: {sandbox_result['stderr'][:300]}\n"
        lc_messages.append(SystemMessage(content=code_feedback))

    async for chunk in llm.astream(lc_messages):
        if chunk.content:
            yield chunk.content
