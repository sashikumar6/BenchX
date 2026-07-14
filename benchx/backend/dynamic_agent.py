"""
Dynamic agent runner.

Executes an OpenAI completion based on a provided AgentConfig.
"""

from __future__ import annotations

import time
from openai import AsyncOpenAI

from .config import OPENAI_API_KEY
from .models import AgentConfig, QueryResponse

_client = AsyncOpenAI(api_key=OPENAI_API_KEY)


async def run_dynamic_agent(
    config: AgentConfig,
    question: str
) -> tuple[dict, float]:
    """
    Run an agent configuration and return (response_data, elapsed_seconds).
    The response_data mimics the old QueryResponse JSON for compatibility.
    """
    start = time.perf_counter()
    
    messages = []
    if config.system_prompt:
        messages.append({"role": "system", "content": config.system_prompt})
    messages.append({"role": "user", "content": question})

    completion = await _client.chat.completions.create(
        model=config.model,
        temperature=config.temperature,
        messages=messages,
    )

    elapsed = time.perf_counter() - start
    
    choice = completion.choices[0]
    usage = completion.usage

    resp = QueryResponse(
        answer=choice.message.content or "",
        model=config.model,
        prompt_tokens=usage.prompt_tokens,
        completion_tokens=usage.completion_tokens,
        total_tokens=usage.total_tokens,
    )
    
    return resp.model_dump(), elapsed
