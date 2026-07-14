"""
BenchX statistical significance engine.

Given N completed runs (each holding per-question results for the same
metrics), compute per-run summary statistics and pairwise paired t-tests
(scipy.stats.ttest_rel) to determine whether one run significantly beats
another on each metric.

The first run passed to `compare_runs` is treated as the baseline; every
other run's overall verdict (BEST / WORST / MIXED / INCONCLUSIVE) is
derived from its paired comparison against that baseline. All pairwise
combinations are still computed and returned so the UI can show
run-vs-run detail beyond just "vs baseline".
"""

from __future__ import annotations

import math
import uuid
from typing import Any

import numpy as np
from scipy import stats

from .config import SIGNIFICANCE_THRESHOLD

METRIC_FIELDS = {
    "latency": "latency_ms",
    "cost": "cost_usd",
    "relevancy": "relevancy_score",
    "hallucination": "hallucination_score",
}

# For these metrics, a lower value is better; relevancy is the exception.
LOWER_IS_BETTER = {"latency", "cost", "hallucination"}


def make_json_serializable(obj: Any) -> Any:
    """Convert values that PostgreSQL JSONB cannot encode into JSON values."""
    if isinstance(obj, dict):
        return {key: make_json_serializable(value) for key, value in obj.items()}
    if isinstance(obj, list):
        return [make_json_serializable(item) for item in obj]
    if isinstance(obj, uuid.UUID):
        return str(obj)
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    return obj


def _field(result: Any, field: str):
    return result[field] if isinstance(result, dict) else getattr(result, field)


def _mean_std(values: list[float]) -> tuple[float, float]:
    arr = np.array(values, dtype=np.float64)
    mean = float(np.mean(arr))
    std = float(np.std(arr, ddof=1)) if len(arr) > 1 else 0.0
    return round(mean, 6), round(std, 6)


def _paired_metric_test(a_values: list[float], b_values: list[float]) -> dict:
    """Paired t-test comparing run B against run A for one metric (delta = B - A)."""
    a = np.array(a_values, dtype=np.float64)
    b = np.array(b_values, dtype=np.float64)

    delta = float(np.mean(b) - np.mean(a))

    if len(a) < 2:
        return {
            "delta": round(delta, 6),
            "p_value": 1.0,
            "significant": False,
            "confidence_interval": None,
        }

    result = stats.ttest_rel(b, a)
    p_value = float(result.pvalue)

    diffs = b - a
    se_diff = float(stats.sem(diffs))
    if se_diff == 0:
        ci = [round(delta, 6), round(delta, 6)]
    else:
        t_crit = float(stats.t.ppf(0.975, df=len(diffs) - 1))
        mean_diff = float(np.mean(diffs))
        ci = [
            round(mean_diff - t_crit * se_diff, 6),
            round(mean_diff + t_crit * se_diff, 6),
        ]

    return {
        "delta": round(delta, 6),
        "p_value": round(p_value, 6),
        "significant": p_value < SIGNIFICANCE_THRESHOLD,
        "confidence_interval": ci,
    }


def _direction(metric_key: str, delta: float, significant: bool) -> str:
    if not significant or delta == 0:
        return "inconclusive"
    lower_is_better = metric_key in LOWER_IS_BETTER
    if lower_is_better:
        return "improved" if delta < 0 else "degraded"
    return "improved" if delta > 0 else "degraded"


def _pairwise_verdict(pair_metrics: dict[str, dict]) -> str:
    improved = sum(1 for m in pair_metrics.values() if m["direction"] == "improved")
    degraded = sum(1 for m in pair_metrics.values() if m["direction"] == "degraded")
    total = len(pair_metrics)
    if total == 0:
        return "INCONCLUSIVE"
    if improved > total / 2:
        return "SHIP RUN B"
    if degraded > total / 2:
        return "SHIP RUN A"
    return "INCONCLUSIVE"


def _run_verdict(direction_counts: dict[str, int]) -> str:
    improved = direction_counts.get("improved", 0)
    degraded = direction_counts.get("degraded", 0)
    total = improved + degraded + direction_counts.get("inconclusive", 0)
    if total == 0:
        return "INCONCLUSIVE"
    if improved > total / 2:
        return "BEST"
    if degraded > total / 2:
        return "WORST"
    if improved > 0 and degraded > 0:
        return "MIXED"
    return "INCONCLUSIVE"


def compare_runs(runs: list[dict]) -> dict:
    """
    Compare N runs across all four metrics.

    Parameters
    ----------
    runs : list[dict]
        Each dict needs: run_id, experiment_name, model, temperature,
        system_prompt, dataset_name, results (list of Result rows or
        dicts exposing question/latency_ms/cost_usd/relevancy_score/
        hallucination_score).

    Returns
    -------
    dict shaped like ComparisonSummary: {"runs": [...], "pairwise": [...]}
    """
    if not runs:
        return {"runs": [], "pairwise": []}

    run_summaries: list[dict] = []
    by_question_per_run: dict[str, dict[str, dict[str, float]]] = {}

    for run in runs:
        results = run["results"]
        metrics = {}
        for metric_key, field in METRIC_FIELDS.items():
            values = [_field(r, field) for r in results]
            mean, std = _mean_std(values) if values else (0.0, 0.0)
            metrics[metric_key] = {"mean": mean, "std": std}

        by_question = {
            _field(r, "question"): {
                metric_key: _field(r, field) for metric_key, field in METRIC_FIELDS.items()
            }
            for r in results
        }
        by_question_per_run[str(run["run_id"])] = by_question

        run_summaries.append(
            {
                "run_id": run["run_id"],
                "experiment_name": run["experiment_name"],
                "model": run["model"],
                "temperature": run["temperature"],
                "system_prompt": run.get("system_prompt"),
                "dataset_name": run["dataset_name"],
                "metrics": metrics,
                "verdict": "BASELINE",
            }
        )

    # ── All pairwise comparisons ─────────────────────────────────────
    pairwise: list[dict] = []
    for i in range(len(runs)):
        for j in range(i + 1, len(runs)):
            run_a, run_b = runs[i], runs[j]
            a_by_q = by_question_per_run[str(run_a["run_id"])]
            b_by_q = by_question_per_run[str(run_b["run_id"])]
            common_questions = [q for q in a_by_q if q in b_by_q]

            pair_metrics: dict[str, dict] = {}
            for metric_key in METRIC_FIELDS:
                if not common_questions:
                    continue
                a_values = [a_by_q[q][metric_key] for q in common_questions]
                b_values = [b_by_q[q][metric_key] for q in common_questions]
                test = _paired_metric_test(a_values, b_values)
                direction = _direction(metric_key, test["delta"], test["significant"])
                pair_metrics[metric_key] = {**test, "direction": direction}

            pairwise.append(
                {
                    "run_a": run_a["run_id"],
                    "run_b": run_b["run_id"],
                    "metrics": pair_metrics,
                    "verdict": _pairwise_verdict(pair_metrics),
                }
            )

    # ── Per-run overall verdict, anchored to the first run (baseline) ─
    baseline_id = runs[0]["run_id"]
    for summary in run_summaries[1:]:
        pair = next(
            (
                p
                for p in pairwise
                if p["run_a"] == baseline_id and p["run_b"] == summary["run_id"]
            ),
            None,
        )
        if pair is None:
            summary["verdict"] = "INCONCLUSIVE"
            continue
        direction_counts: dict[str, int] = {}
        for m in pair["metrics"].values():
            direction_counts[m["direction"]] = direction_counts.get(m["direction"], 0) + 1
        summary["verdict"] = _run_verdict(direction_counts)

    return {"runs": run_summaries, "pairwise": pairwise}
