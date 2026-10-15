"""
RAG Knowledge Base Initializer
Run this once to populate ChromaDB with interview knowledge documents.
Usage: cd <project_root> && python -m backend.rag.init_kb
"""
import os
import sys
import time
from pathlib import Path
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import TextLoader
from langchain_core.embeddings import Embeddings

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.config import settings

DATA_DIR = Path(__file__).parent / "data"

# DashScope embedding API only allows ≤10 texts per request
_EMBED_BATCH_SIZE = 10


class BatchedEmbeddings(Embeddings):
    """Wrapper that splits embed_documents into batches of ≤10."""

    def __init__(self, base: OpenAIEmbeddings, batch_size: int = _EMBED_BATCH_SIZE):
        self._base = base
        self._batch_size = batch_size

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        results: list[list[float]] = []
        for i in range(0, len(texts), self._batch_size):
            batch = texts[i: i + self._batch_size]
            results.extend(self._base.embed_documents(batch))
            # Brief pause to avoid rate-limit bursts
            if i + self._batch_size < len(texts):
                time.sleep(0.2)
        return results

    def embed_query(self, text: str) -> list[float]:
        return self._base.embed_query(text)


def init_knowledge_base():
    print("🔄 初始化面试知识库...")

    base_embeddings = OpenAIEmbeddings(
        model="text-embedding-v3",
        api_key=settings.dashscope_api_key,
        base_url=settings.llm_base_url,
        check_embedding_ctx_length=False,
    )
    embeddings = BatchedEmbeddings(base_embeddings)

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=100,
        separators=["\n## ", "\n### ", "\n\n", "\n", "。"],
    )

    docs = []
    md_files = list(DATA_DIR.glob("*.md"))
    if not md_files:
        print("❌ rag/data/ 目录下没有找到 .md 文件")
        return

    for md_file in md_files:
        loader = TextLoader(str(md_file), encoding="utf-8")
        raw_docs = loader.load()
        for doc in raw_docs:
            doc.metadata["source"] = md_file.stem
        chunks = splitter.split_documents(raw_docs)
        docs.extend(chunks)
        print(f"  ✅ {md_file.name}: {len(chunks)} chunks")

    print(f"\n📤 开始写入向量库（共 {len(docs)} 块，每批 {_EMBED_BATCH_SIZE} 条）...")
    vectorstore = Chroma.from_documents(
        documents=docs,
        embedding=embeddings,
        collection_name=settings.chroma_collection,
        persist_directory=settings.chroma_persist_dir,
    )
    print(f"✅ 知识库初始化完成，共 {len(docs)} 个文本块已写入 {settings.chroma_persist_dir}")


if __name__ == "__main__":
    init_knowledge_base()
