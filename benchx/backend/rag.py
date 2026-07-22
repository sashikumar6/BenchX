"""
BenchX RAG pipeline — chunking, lazy embedding, and retrieval.

Chunks are keyed by (corpus_id, chunk_size), not just corpus_id: two
experiments pointed at the same corpus with different chunk_size values get
their own disjoint set of chunk rows, so retrieval genuinely differs between
them. See DECISIONS.md ADR-020 for the full rationale, including why
chunking happens once at run-start rather than lazily inside each
concurrent per-question task (to avoid a duplicate-row race).
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .database import Chunk, Document
from .embeddings import get_embedding, get_embeddings

# Consecutive chunks overlap by this fraction of chunk_size words, so a
# sentence split across a chunk boundary still appears whole in at least
# one chunk.
CHUNK_OVERLAP_RATIO = 0.175

RAG_PROMPT_TEMPLATE = (
    "Answer the question using only the information in the context below. "
    "If the context does not contain the answer, say you don't know rather "
    "than guessing.\n\n"
    "Context:\n{context}\n\n"
    "Question: {question}"
)


def chunk_text(text: str, chunk_size: int, overlap_ratio: float = CHUNK_OVERLAP_RATIO) -> list[str]:
    """Paragraph-aware greedy packing to ~chunk_size words, with word-overlap
    between consecutive chunks.

    Word-count is a proxy for token-count — no tokenizer dependency is added
    here. That's fine because chunk_size is only ever compared *relatively*
    within BenchX (chunk_size=256 vs chunk_size=1024 against the same
    corpus), never against an external token budget.
    """
    paragraphs = [p.split() for p in text.split("\n\n") if p.strip()]
    overlap_words = max(1, int(chunk_size * overlap_ratio))

    chunks: list[str] = []
    buffer: list[str] = []

    def flush() -> list[str]:
        """Emit the current buffer as a chunk; return the overlap tail to seed the next one."""
        if buffer:
            chunks.append(" ".join(buffer))
        return buffer[-overlap_words:] if buffer else []

    for para_words in paragraphs:
        if len(para_words) > chunk_size:
            # A single paragraph longer than chunk_size: flush what we have,
            # then hard-split this paragraph by words.
            buffer = flush()
            for start in range(0, len(para_words), chunk_size):
                buffer.extend(para_words[start : start + chunk_size])
                if len(buffer) >= chunk_size:
                    buffer = flush()
            continue

        if len(buffer) + len(para_words) > chunk_size and buffer:
            buffer = flush()
        buffer.extend(para_words)

    if buffer:
        chunks.append(" ".join(buffer))

    return chunks


async def ensure_chunks(session: AsyncSession, corpus_id: UUID, chunk_size: int) -> list[Chunk]:
    """Return cached chunks for (corpus_id, chunk_size); compute+embed+persist on first use."""
    existing = (
        await session.execute(
            select(Chunk).where(Chunk.corpus_id == corpus_id, Chunk.chunk_size == chunk_size)
        )
    ).scalars().all()
    if existing:
        return list(existing)

    documents = (
        await session.execute(select(Document).where(Document.corpus_id == corpus_id))
    ).scalars().all()

    pieces = [
        (doc.id, index, text)
        for doc in documents
        for index, text in enumerate(chunk_text(doc.content, chunk_size))
    ]
    if not pieces:
        return []

    embeddings = await get_embeddings([text for _, _, text in pieces])
    rows = [
        Chunk(
            corpus_id=corpus_id,
            document_id=document_id,
            chunk_size=chunk_size,
            chunk_index=index,
            content=text,
            embedding=embedding,
        )
        for (document_id, index, text), embedding in zip(pieces, embeddings)
    ]
    session.add_all(rows)
    await session.commit()
    return rows


async def retrieve_chunks(
    session: AsyncSession, corpus_id: UUID, chunk_size: int, question: str, top_k: int
) -> list[Chunk]:
    """Ensure chunks exist for this (corpus, chunk_size) pair, then return the top_k nearest to question."""
    await ensure_chunks(session, corpus_id, chunk_size)

    q_embedding = await get_embedding(question)
    result = await session.execute(
        select(Chunk)
        .where(Chunk.corpus_id == corpus_id, Chunk.chunk_size == chunk_size)
        .options(selectinload(Chunk.document))
        .order_by(Chunk.embedding.cosine_distance(q_embedding))
        .limit(top_k)
    )
    return list(result.scalars().all())


def build_rag_prompt(question: str, chunks: list[Chunk]) -> str:
    context = "\n\n---\n\n".join(chunk.content for chunk in chunks)
    return RAG_PROMPT_TEMPLATE.format(context=context, question=question)
