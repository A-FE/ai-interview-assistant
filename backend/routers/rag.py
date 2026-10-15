"""
RAG knowledge base inspection router.
Provides read-only access to ChromaDB documents for the admin UI.
"""
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import chromadb
from backend.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/rag", tags=["rag"])


def _get_client() -> chromadb.ClientAPI:
    return chromadb.PersistentClient(path=settings.chroma_persist_dir)


def _get_collection(client: chromadb.ClientAPI):
    try:
        return client.get_collection(settings.chroma_collection)
    except Exception:
        raise HTTPException(status_code=404, detail="知识库 collection 不存在，请先运行 init_kb")


# ─── Schemas ─────────────────────────────────────────────────────────────────

class DocSummary(BaseModel):
    source: str
    chunk_count: int


class Chunk(BaseModel):
    id: str
    text: str
    index: int
    extra_meta: Optional[dict] = None


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/docs", response_model=list[DocSummary])
def list_docs():
    """List all source documents with their chunk counts."""
    client = _get_client()
    col = _get_collection(client)
    total = col.count()
    if total == 0:
        return []

    # Fetch all metadata (no embeddings/documents needed)
    result = col.get(include=["metadatas"])
    source_counts: dict[str, int] = {}
    for meta in result["metadatas"]:
        src = meta.get("source", "(未知来源)") if meta else "(未知来源)"
        source_counts[src] = source_counts.get(src, 0) + 1

    return [
        DocSummary(source=src, chunk_count=count)
        for src, count in sorted(source_counts.items())
    ]


@router.get("/docs/{source}/chunks", response_model=list[Chunk])
def get_chunks(source: str):
    """Return all chunks for a given source document."""
    client = _get_client()
    col = _get_collection(client)

    result = col.get(
        where={"source": source},
        include=["documents", "metadatas"],
    )
    ids = result.get("ids", [])
    docs = result.get("documents", [])
    metas = result.get("metadatas", [])

    if not ids:
        raise HTTPException(status_code=404, detail=f"未找到来源为 '{source}' 的文档块")

    chunks = []
    for i, (chunk_id, text, meta) in enumerate(zip(ids, docs, metas)):
        extra = {k: v for k, v in (meta or {}).items() if k != "source"}
        chunks.append(Chunk(
            id=chunk_id,
            text=text or "",
            index=i + 1,
            extra_meta=extra if extra else None,
        ))
    return chunks
