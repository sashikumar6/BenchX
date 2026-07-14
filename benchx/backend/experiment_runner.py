"""
BenchX experiment runner.

Executes a configured experiment against every question in a dataset:
call the LLM, score the response with all four evaluators concurrently,
persist the result, and advance run progress — one question at a time,
bounded by a concurrency semaphore so we don't trip provider rate limits.
"""

from __future__ import annotations

import asyncio
import time
from uuid import UUID

from anthropic import AsyncAnthropic
from openai import AsyncOpenAI

from .config import (
    ANTHROPIC_API_KEY,
    GROQ_API_KEY,
    GROQ_BASE_URL,
    MAX_CONCURRENT_REQUESTS,
    OPENAI_API_KEY,
    SUPPORTED_MODELS,
)
from .database import Dataset, Experiment, ExperimentStatus, RunStatus, async_session
from .evaluators import evaluate_cost, evaluate_hallucination, evaluate_latency, evaluate_relevancy
from . import experiment_registry as registry

_openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
_anthropic_client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
_groq_client = AsyncOpenAI(api_key=GROQ_API_KEY, base_url=GROQ_BASE_URL)


async def _call_model(experiment: Experiment, question: str) -> tuple[str, int, int, float]:
    """Call the experiment's configured model. Returns (answer, tokens_in, tokens_out, latency_ms)."""
    provider = SUPPORTED_MODELS[experiment.model]["provider"]
    start = time.perf_counter()

    if provider == "anthropic":
        kwargs = dict(
            model=experiment.model,
            max_tokens=experiment.max_tokens,
            temperature=experiment.temperature,
            messages=[{"role": "user", "content": question}],
        )
        if experiment.system_prompt:
            kwargs["system"] = experiment.system_prompt
        completion = await _anthropic_client.messages.create(**kwargs)
        elapsed = time.perf_counter() - start
        answer = "".join(block.text for block in completion.content if block.type == "text")
        tokens_in = completion.usage.input_tokens
        tokens_out = completion.usage.output_tokens
    else:
        client = _openai_client if provider == "openai" else _groq_client
        messages = []
        if experiment.system_prompt:
            messages.append({"role": "system", "content": experiment.system_prompt})
        messages.append({"role": "user", "content": question})

        completion = await client.chat.completions.create(
            model=experiment.model,
            temperature=experiment.temperature,
            max_tokens=experiment.max_tokens,
            messages=messages,
        )
        elapsed = time.perf_counter() - start
        answer = completion.choices[0].message.content or ""
        tokens_in = completion.usage.prompt_tokens
        tokens_out = completion.usage.completion_tokens

    return answer, tokens_in, tokens_out, evaluate_latency(elapsed)


async def _process_question(
    experiment: Experiment,
    run_id: UUID,
    question: str,
    ground_truth: str | None,
    semaphore: asyncio.Semaphore,
) -> bool:
    """Run one question end-to-end. Always writes a result row so the run can
    reach 100% progress even if this question failed."""
    async with semaphore:
        try:
            answer, tokens_in, tokens_out, latency_ms = await _call_model(experiment, question)
            cost_usd = evaluate_cost(experiment.model, tokens_in, tokens_out)
            relevancy_score, hallucination = await asyncio.gather(
                evaluate_relevancy(question, answer, ground_truth),
                evaluate_hallucination(question, answer),
            )
            success = True
        except Exception as exc:  # noqa: BLE001 - isolate one bad question from the rest of the run
            answer = f"[ERROR] {exc}"
            tokens_in = tokens_out = 0
            latency_ms = 0.0
            cost_usd = 0.0
            relevancy_score = 0.0
            hallucination = {"score": 0.0, "reason": f"Evaluation skipped after error: {exc}"}
            success = False

        async with async_session() as session:
            await registry.add_result(
                session,
                run_id,
                question=question,
                ground_truth=ground_truth,
                response=answer,
                latency_ms=latency_ms,
                cost_usd=cost_usd,
                relevancy_score=relevancy_score,
                hallucination_score=hallucination["score"],
                hallucination_reason=hallucination["reason"],
                tokens_input=tokens_in,
                tokens_output=tokens_out,
            )
            await registry.increment_run_progress(session, run_id)

        return success


async def run_experiment(experiment_id: UUID, dataset_id: UUID, run_id: UUID) -> None:
    """Entry point invoked as a background task from POST /runs."""
    async with async_session() as session:
        experiment = await session.get(Experiment, experiment_id)
        dataset = await session.get(Dataset, dataset_id)

    if experiment is None or dataset is None:
        async with async_session() as session:
            await registry.finish_run(
                session, run_id, RunStatus.failed, error="Experiment or dataset not found"
            )
        return

    async with async_session() as session:
        await registry.set_experiment_status(session, experiment_id, ExperimentStatus.running)

    semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
    tasks = [
        _process_question(experiment, run_id, q["question"], q.get("ground_truth"), semaphore)
        for q in dataset.questions
    ]
    outcomes = await asyncio.gather(*tasks) if tasks else []

    run_succeeded = bool(outcomes) and any(outcomes)
    final_status = RunStatus.completed if run_succeeded else RunStatus.failed
    experiment_status = (
        ExperimentStatus.completed if run_succeeded else ExperimentStatus.failed
    )

    async with async_session() as session:
        await registry.finish_run(
            session,
            run_id,
            final_status,
            error=None if run_succeeded else "All questions in this run failed",
        )
        await registry.set_experiment_status(session, experiment_id, experiment_status)
