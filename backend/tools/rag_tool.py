"""
RAG retrieval tool: query ChromaDB for relevant interview knowledge.
"""
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings
from backend.config import settings


def _get_vectorstore() -> Chroma:
    embeddings = OpenAIEmbeddings(
        model="text-embedding-v3",
        api_key=settings.dashscope_api_key,
        base_url=settings.llm_base_url,
    )
    return Chroma(
        collection_name=settings.chroma_collection,
        persist_directory=settings.chroma_persist_dir,
        embedding_function=embeddings,
    )


def rag_search(query: str, k: int = 4) -> str:
    """Retrieve top-k relevant interview knowledge chunks."""
    try:
        vectorstore = _get_vectorstore()
        docs = vectorstore.similarity_search(query, k=k)
        if not docs:
            return "（知识库暂无相关内容）"
        parts = []
        for i, doc in enumerate(docs, 1):
            source = doc.metadata.get("source", "知识库")
            parts.append(f"【参考{i}·{source}】\n{doc.page_content}")
        return "\n\n".join(parts)
    except Exception as e:
        return f"（RAG检索失败: {e}）"
