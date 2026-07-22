"""
Relevancy evaluator — cosine similarity via OpenAI embeddings.

If ground_truth is provided, computes similarity between the response
and the expected answer. Otherwise, computes similarity between the
question and the response.
"""

from __future__ import annotations

import asyncio
from typing import Optional

import numpy as np

from ..embeddings import get_embedding as _get_embedding


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    va = np.array(a, dtype=np.float64)
    vb = np.array(b, dtype=np.float64)
    denom = np.linalg.norm(va) * np.linalg.norm(vb)
    if denom == 0:
        return 0.0
    return float(np.dot(va, vb) / denom)


async def evaluate_relevancy(
    question: str,
    response: str,
    ground_truth: Optional[str] = None,
) -> float:
    """
    Score how relevant a response is.

    Parameters
    ----------
    question : str
        The original question.
    response : str
        The agent's response.
    ground_truth : str | None
        The expected answer (optional).

    Returns
    -------
    float
        Cosine similarity score between 0 and 1.
    """
    reference_text = ground_truth if ground_truth is not None else question
    response_emb, reference_emb = await asyncio.gather(
        _get_embedding(response), _get_embedding(reference_text)
    )

    return round(_cosine_similarity(response_emb, reference_emb), 6)
