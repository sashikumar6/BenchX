"""
BenchX core comparison engine.

Orchestrates: agent calls → metric evaluation → statistical analysis → verdict.
"""

from __future__ import annotations

import asyncio
from typing import Optional

from fastapi import APIRouter

from .models import (
    AgentConfig,
    CompareRequest,
    CompareResponse,
    MetricScores,
    MetricSummary,
    PerQuestionResult,
)
from .dynamic_agent import run_dynamic_agent
from .evaluators.latency import evaluate_latency
from .evaluators.cost import evaluate_cost
from .evaluators.relevancy import evaluate_relevancy
from .evaluators.hallucination import evaluate_hallucination
from .stats import paired_ttest, compute_verdict

router = APIRouter(tags=["compare"])


async def _evaluate_single(
    question: str,
    baseline_config: AgentConfig,
    candidate_config: AgentConfig,
    metrics: list[str],
    ground_truth: Optional[str] = None,
) -> PerQuestionResult:
    """
    For a single question, call both agents dynamically and compute all requested metrics.
    """
    # ── Call both agents simultaneously ─────────────────────────────
    (bl_data, bl_elapsed), (cd_data, cd_elapsed) = await asyncio.gather(
        run_dynamic_agent(baseline_config, question),
        run_dynamic_agent(candidate_config, question),
    )

    bl_answer: str = bl_data["answer"]
    cd_answer: str = cd_data["answer"]

    # ── Evaluate metrics ────────────────────────────────────────────
    bl_scores: dict[str, Optional[float]] = {}
    cd_scores: dict[str, Optional[float]] = {}

    if "latency" in metrics:
        bl_scores["latency"] = evaluate_latency(bl_elapsed)
        cd_scores["latency"] = evaluate_latency(cd_elapsed)

    if "cost" in metrics:
        bl_scores["cost"] = evaluate_cost(
            bl_data["prompt_tokens"], bl_data["completion_tokens"]
        )
        cd_scores["cost"] = evaluate_cost(
            cd_data["prompt_tokens"], cd_data["completion_tokens"]
        )

    if "relevancy" in metrics:
        bl_rel, cd_rel = await asyncio.gather(
            evaluate_relevancy(question, bl_answer, ground_truth),
            evaluate_relevancy(question, cd_answer, ground_truth),
        )
        bl_scores["relevancy"] = bl_rel
        cd_scores["relevancy"] = cd_rel

    if "hallucination" in metrics:
        bl_hal, cd_hal = await asyncio.gather(
            evaluate_hallucination(question, bl_answer),
            evaluate_hallucination(question, cd_answer),
        )
        bl_scores["hallucination"] = bl_hal
        cd_scores["hallucination"] = cd_hal

    # ── Compute deltas ──────────────────────────────────────────────
    deltas: dict[str, Optional[float]] = {}
    for m in metrics:
        bl_val = bl_scores.get(m)
        cd_val = cd_scores.get(m)
        if bl_val is not None and cd_val is not None:
            deltas[m] = round(cd_val - bl_val, 6)

    return PerQuestionResult(
        question=question,
        ground_truth=ground_truth,
        baseline_response=bl_answer,
        candidate_response=cd_answer,
        baseline_metrics=MetricScores(**bl_scores),
        candidate_metrics=MetricScores(**cd_scores),
        deltas=MetricScores(**deltas),
    )


@router.post("/compare", response_model=CompareResponse)
async def compare(req: CompareRequest) -> CompareResponse:
    """
    Run a full A/B comparison between baseline and candidate agents.

    1. For each question, call both agents simultaneously.
    2. Run all requested metric evaluators on both responses.
    3. Aggregate scores and run paired t-tests.
    4. Return per-question results + summary + verdict.
    """
    tasks = []
    for idx, question in enumerate(req.questions):
        gt = (
            req.ground_truth[idx]
            if req.ground_truth and idx < len(req.ground_truth)
            else None
        )
        tasks.append(
            _evaluate_single(
                question=question,
                baseline_config=req.baseline_config,
                candidate_config=req.candidate_config,
                metrics=req.metrics,
                ground_truth=gt,
            )
        )

    per_question: list[PerQuestionResult] = await asyncio.gather(*tasks)

    # ── Aggregate & run statistical tests ───────────────────────────
    summaries: dict[str, dict] = {}

    for metric in req.metrics:
        bl_vals = [
            getattr(pq.baseline_metrics, metric)
            for pq in per_question
            if getattr(pq.baseline_metrics, metric) is not None
        ]
        cd_vals = [
            getattr(pq.candidate_metrics, metric)
            for pq in per_question
            if getattr(pq.candidate_metrics, metric) is not None
        ]

        if bl_vals and cd_vals:
            summaries[metric] = paired_ttest(bl_vals, cd_vals)

    verdict, metrics_improved, metrics_total = compute_verdict(summaries)

    # Convert raw dicts to MetricSummary models
    summary_models: dict[str, MetricSummary] = {
        k: MetricSummary(**v) for k, v in summaries.items()
    }

    return CompareResponse(
        summary=summary_models,
        verdict=verdict,
        metrics_improved=metrics_improved,
        metrics_total=metrics_total,
        per_question=per_question,
    )
