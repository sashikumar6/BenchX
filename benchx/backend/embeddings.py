"""
Shared OpenAI embedding client — cached by text hash.

Used by both the relevancy evaluator and the RAG retrieval pipeline
(backend/rag.py), so identical text is only ever embedded once per process.
"""

from __future__ import annotations

import hashlib

from openai import AsyncOpenAI

from .config import EMBEDDING_MODEL, OPENAI_API_KEY

_client = AsyncOpenAI(api_key=OPENAI_API_KEY)

_embedding_cache: dict[str, list[float]] = {}


def _hash_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


async def get_embedding(text: str) -> list[float]:
    """Fetch an embedding vector for a single text, using the cache when possible."""
    key = _hash_text(text)
    cached = _embedding_cache.get(key)
    if cached is not None:
        return cached

    resp = await _client.embeddings.create(input=text, model=EMBEDDING_MODEL)
    embedding = resp.data[0].embedding
    _embedding_cache[key] = embedding
    return embedding


async def get_embeddings(texts: list[str]) -> list[list[float]]:
    """Batch-fetch embeddings for many texts, reusing the cache for any hits.

    Used for corpus ingestion, where a single document can produce dozens of
    chunks that would otherwise mean dozens of sequential API calls.
    """
    keys = [_hash_text(text) for text in texts]
    uncached_indices = [i for i, key in enumerate(keys) if key not in _embedding_cache]

    if uncached_indices:
        resp = await _client.embeddings.create(
            input=[texts[i] for i in uncached_indices],
            model=EMBEDDING_MODEL,
        )
        for i, item in zip(uncached_indices, resp.data):
            _embedding_cache[keys[i]] = item.embedding

    return [_embedding_cache[key] for key in keys]
