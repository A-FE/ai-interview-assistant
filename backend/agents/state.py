"""Shared LangGraph state and LLM client factory."""
from typing import Annotated, TypedDict, Optional
import operator
from langchain_openai import ChatOpenAI
from backend.config import settings


def get_llm(streaming: bool = True) -> ChatOpenAI:
    return ChatOpenAI(
        model=settings.llm_model,
        api_key=settings.dashscope_api_key,
        base_url=settings.llm_base_url,
        streaming=streaming,
        temperature=0.7,
    )


class AgentState(TypedDict):
    messages: Annotated[list, operator.add]
    jd_analysis: Optional[str]
    history_report_json: Optional[str]
    user_resume: Optional[str]
