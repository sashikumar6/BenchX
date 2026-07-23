"""
BenchX experiment runner.

Executes a configured experiment against every question in a dataset:
call the LLM, score the response with all four evaluators concurrently,
persist the result, and advance run progress — one question at a time,
bounded by a concurrency semaphore so we don't trip provider rate limits.
"""

from __future__ import annotations

import asyncio
import math
import time
from statistics import mean, stdev
from typing import Any, Protocol
from uuid import UUID

from anthropic import AsyncAnthropic
import httpx
from openai import AsyncOpenAI

from .config import (
    GROQ_BASE_URL,
    MAX_CONCURRENT_REQUESTS,
    NVIDIA_BASE_URL,
    SUPPORTED_MODELS,
    get_provider_api_key,
)
from .database import Dataset, Experiment, ExperimentStatus, ExperimentType, RunStatus, async_session
from .evaluators import evaluate_cost, evaluate_hallucination, evaluate_latency, evaluate_relevancy
from . import experiment_registry as registry
from . import rag

class ProgressSocket(Protocol):
    async def send_json(self, event: dict[str, Any]) -> None: ...


def get_provider_client(model_key: str):
    """Build the correct SDK client and fail clearly when its key is absent."""
    model = SUPPORTED_MODELS[model_key]
    provider = model["provider"]
    api_key = get_provider_api_key(provider)
    if provider == "openai":
        return AsyncOpenAI(api_key=api_key)
    if provider == "anthropic":
        return AsyncAnthropic(api_key=api_key)
    if provider == "groq":
        return AsyncOpenAI(api_key=api_key, base_url=GROQ_BASE_URL)
    if provider == "nvidia":
        return AsyncOpenAI(api_key=api_key, base_url=NVIDIA_BASE_URL)
    raise ValueError(f"Unsupported provider '{provider}'")


async def _call_model(experiment: Experiment, question: str) -> tuple[str, int, int, float]:
    """Call the experiment's configured model. Returns (answer, tokens_in, tokens_out, latency_ms)."""
    provider = SUPPORTED_MODELS[experiment.model]["provider"]
    start = time.perf_counter()

    client = get_provider_client(experiment.model)

    if provider == "anthropic":
        kwargs = dict(
            model=experiment.model,
            max_tokens=experiment.max_tokens,
            temperature=experiment.temperature,
            messages=[{"role": "user", "content": question}],
        )
        if experiment.system_prompt:
            kwargs["system"] = experiment.system_prompt
        completion = await client.messages.create(**kwargs)
        elapsed = time.perf_counter() - start
        answer = "".join(block.text for block in completion.content if block.type == "text")
        tokens_in = completion.usage.input_tokens
        tokens_out = completion.usage.output_tokens
    else:
        messages = []
        if experiment.system_prompt:
            messages.append({"role": "system", "content": experiment.system_prompt})
        messages.append({"role": "user", "content": question})

        # OpenAI's reasoning models (o1/o3 family) reject `temperature` outright
        # and use `max_completion_tokens` in place of `max_tokens`.
        is_reasoning_model = SUPPORTED_MODELS[experiment.model]["category"] == "reasoning"
        kwargs: dict[str, Any] = dict(model=experiment.model, messages=messages)
        if is_reasoning_model:
            kwargs["max_completion_tokens"] = experiment.max_tokens
        else:
            kwargs["temperature"] = experiment.temperature
            kwargs["max_tokens"] = experiment.max_tokens

        completion = await client.chat.completions.create(**kwargs)
        elapsed = time.perf_counter() - start
        answer = completion.choices[0].message.content or ""
        tokens_in = completion.usage.prompt_tokens
        tokens_out = completion.usage.completion_tokens

    return answer, tokens_in, tokens_out, evaluate_latency(elapsed)


async def _call_external_agent(experiment: Experiment, question: str) -> tuple[str, int, int, float]:
    """Call BenchX's minimal external-agent protocol with a hard timeout."""
    if not experiment.endpoint_url:
        raise ValueError("External experiment is missing an endpoint URL")

    headers: dict[str, str] = {}
    if experiment.auth_header:
        token = experiment.auth_header.strip()
        headers["Authorization"] = token if token.lower().startswith("bearer ") else f"Bearer {token}"

    start = time.perf_counter()
    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as client:
        response = await client.post(experiment.endpoint_url, json={"question": question}, headers=headers)
        response.raise_for_status()
    elapsed = time.perf_counter() - start
    payload = response.json()
    if not isinstance(payload, dict) or not isinstance(payload.get("answer"), str):
        raise ValueError('External agent must return JSON with an "answer" string')

    answer = payload["answer"]
    tokens_used = payload.get("tokens_used")
    if isinstance(tokens_used, (int, float)) and math.isfinite(tokens_used):
        tokens_out = max(0, int(tokens_used))
    else:
        tokens_out = max(1, math.ceil(len(answer.split()) * 1.3))
    tokens_in = max(1, math.ceil(len(question.split()) * 1.3))
    return answer, tokens_in, tokens_out, evaluate_latency(elapsed)


async def _process_question(
    experiment: Experiment,
    run_id: UUID,
    question: str,
    ground_truth: str | None,
    semaphore: asyncio.Semaphore,
    websocket: ProgressSocket | None = None,
) -> bool:
    """Run one question end-to-end. Always writes a result row so the run can
    reach 100% progress even if this question failed."""
    async with semaphore:
        retrieved: list[dict[str, Any]] | None = None
        try:
            if experiment.type == ExperimentType.external:
                answer, tokens_in, tokens_out, latency_ms = await _call_external_agent(experiment, question)
                cost_usd = 0.0
            else:
                prompt_question = question
                if experiment.corpus_id is not None:
                    async with async_session() as rag_session:
                        chunks = await rag.retrieve_chunks(
                            rag_session, experiment.corpus_id, experiment.chunk_size, question, experiment.top_k
                        )
                    retrieved = [
                        {"chunk_id": str(c.id), "document_filename": c.document.filename, "content": c.content}
                        for c in chunks
                    ]
                    prompt_question = rag.build_rag_prompt(question, chunks)
                answer, tokens_in, tokens_out, latency_ms = await _call_model(experiment, prompt_question)
                cost_usd = evaluate_cost(experiment.model, tokens_in, tokens_out)
            # The judge and relevancy scorer always see the original question,
            # never the RAG-augmented prompt — they score the answer against
            # what was actually asked, not BenchX's internal wrapper text.
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
            result = await registry.add_result(
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
                retrieved_chunk_ids=retrieved,
            )
            completed, total = await registry.increment_run_progress(session, run_id)

        if websocket is not None:
            try:
                await websocket.send_json(
                    {
                        "type": "progress",
                        "run_id": str(run_id),
                        "completed": completed,
                        "total": total,
                        "latest_result": {
                            "id": str(result.id),
                            "question": result.question,
                            "response": result.response,
                            "latency_ms": result.latency_ms,
                            "cost_usd": result.cost_usd,
                            "relevancy_score": result.relevancy_score,
                            "hallucination_score": result.hallucination_score,
                        },
                    }
                )
            except Exception:
                # Browser disconnects must never affect experiment execution.
                pass

        return success


def build_run_summary(results: list[Any]) -> dict[str, dict[str, float]]:
    """Return the compact four-metric payload sent at WebSocket completion."""
    fields = {
        "latency_ms": "latency_ms",
        "cost_usd": "cost_usd",
        "relevancy_score": "relevancy_score",
        "hallucination_score": "hallucination_score",
    }
    summary: dict[str, dict[str, float]] = {}
    for key, field in fields.items():
        values = [float(getattr(result, field)) for result in results]
        summary[key] = {
            "mean": round(mean(values), 6) if values else 0.0,
            "std": round(stdev(values), 6) if len(values) > 1 else 0.0,
        }
    return summary


async def run_experiment(
    experiment_id: UUID,
    dataset_id: UUID,
    run_id: UUID,
    websocket: ProgressSocket | None = None,
    replicate_count: int = 1,
) -> None:
    """Entry point invoked as a background task from POST /runs."""
    async with async_session() as session:
        experiment = await session.get(Experiment, experiment_id)
        dataset = await session.get(Dataset, dataset_id)

    if experiment is None or dataset is None:
        async with async_session() as session:
            await registry.finish_run(
                session, run_id, RunStatus.failed, error="Experiment or dataset not found"
            )
        if websocket is not None:
            await websocket.send_json(
                {"type": "error", "run_id": str(run_id), "message": "Experiment or dataset not found"}
            )
        return

    async with async_session() as session:
        await registry.set_experiment_status(session, experiment_id, ExperimentStatus.running)

    if experiment.corpus_id is not None and experiment.type == ExperimentType.builtin:
        # Chunk+embed once, up front — not lazily inside the concurrent
        # per-question tasks below, which would race to create duplicate
        # rows the first time a (corpus, chunk_size) pair is used. See ADR-020.
        async with async_session() as session:
            await rag.ensure_chunks(session, experiment.corpus_id, experiment.chunk_size)

    semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
    tasks = [
        _process_question(
            experiment, run_id, q["question"], q.get("ground_truth"), semaphore, websocket
        )
        for q in dataset.questions
        for _ in range(replicate_count)
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

        completed_run = await registry.get_run(session, run_id)

    if websocket is not None:
        if run_succeeded:
            await websocket.send_json(
                {
                    "type": "completed",
                    "run_id": str(run_id),
                    "summary": build_run_summary(completed_run.results if completed_run else []),
                }
            )
        else:
            await websocket.send_json(
                {
                    "type": "error",
                    "run_id": str(run_id),
                    "message": "All questions in this run failed",
                }
            )
