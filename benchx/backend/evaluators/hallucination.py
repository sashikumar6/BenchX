"""
Hallucination evaluator — LLM-as-judge using GPT-4o-mini.

Asks a fixed judge model to score how likely a response is to contain
hallucinated or fabricated information, independent of which model
generated the response.
"""

from __future__ import annotations

import json

from openai import AsyncOpenAI

from ..config import OPENAI_API_KEY, HALLUCINATION_JUDGE_MODEL

_client = AsyncOpenAI(api_key=OPENAI_API_KEY)

_SYSTEM_PROMPT = (
    "You are an expert evaluator. Score the likelihood that the following "
    "response contains hallucinated or fabricated information. Return only "
    "a JSON object: {score: float 0-1, reason: string}"
)


async def evaluate_hallucination(question: str, response: str) -> dict:
    """
    Score how likely a response is to contain hallucinations.

    Parameters
    ----------
    question : str
        The original question.
    response : str
        The agent's response.

    Returns
    -------
    dict
        {"score": float between 0 and 1, "reason": str}
        Lower score is better (less hallucination).
    """
    user_prompt = f"Question: {question}\nResponse: {response}"

    completion = await _client.chat.completions.create(
        model=HALLUCINATION_JUDGE_MODEL,
        temperature=0.0,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    )

    raw = completion.choices[0].message.content or "{}"

    try:
        parsed = json.loads(raw)
        score = float(parsed.get("score", 0.5))
        reason = str(parsed.get("reason", ""))
        return {"score": round(max(0.0, min(1.0, score)), 4), "reason": reason}
    except (ValueError, TypeError):
        return {"score": 0.5, "reason": "Judge returned an unparsable response."}
