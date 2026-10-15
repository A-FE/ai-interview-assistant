"""
RAG Knowledge Base Initializer
Run this once to populate ChromaDB with interview knowledge documents.
Usage: cd <project_root> && python -m backend.rag.init_kb
"""
import os
import sys
from pathlib import Path
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import TextLoader

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.config import settings

DATA_DIR = Path(__file__).parent / "data"


def init_knowledge_base():
    print("🔄 初始化面试知识库...")

    embeddings = OpenAIEmbeddings(
        model="text-embedding-v3",
        api_key=settings.dashscope_api_key,
        base_url=settings.llm_base_url,
        check_embedding_ctx_length=False,  # 禁用 token 化，直接传字符串
    )

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

    vectorstore = Chroma.from_documents(
        documents=docs,
        embedding=embeddings,
        collection_name=settings.chroma_collection,
        persist_directory=settings.chroma_persist_dir,
    )
    print(f"\n✅ 知识库初始化完成，共 {len(docs)} 个文本块已写入 {settings.chroma_persist_dir}")


if __name__ == "__main__":
    init_knowledge_base()
