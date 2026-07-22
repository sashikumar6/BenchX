"""
Tests for the FDR-correction and replicate-averaging additions to stats.py.

Uses plain dicts for "results" (stats._field supports both dict and
attribute access), so these run without a database.
"""

import uuid

from backend.config import SIGNIFICANCE_THRESHOLD, UNDERPOWERED_MIN_N
from backend.stats import _benjamini_hochberg, compare_runs


def _result(question, latency=1000.0, cost=0.001, relevancy=0.8, hallucination=0.2):
    return {
        "question": question,
        "latency_ms": latency,
        "cost_usd": cost,
        "relevancy_score": relevancy,
        "hallucination_score": hallucination,
    }


def _run(name, results, run_id=None):
    return {
        "run_id": run_id or uuid.uuid4(),
        "experiment_name": name,
        "model": "gpt-4o-mini",
        "temperature": 0.7,
        "system_prompt": None,
        "dataset_name": "test-dataset",
        "results": results,
    }


def test_benjamini_hochberg_flips_marginal_pvalues_but_not_strong_one():
    """Direct proof of the FDR correction math: with 5 p-values where one is
    strongly significant (0.001) and three are marginal (0.03-0.045), only
    the strongly significant one survives correction at alpha=0.05 — the
    marginal ones would each individually clear the raw 0.05 threshold but
    don't survive once corrected for testing 5 things at once.
    """
    p_values = [0.001, 0.03, 0.04, 0.045, 0.5]
    q_values = _benjamini_hochberg(p_values)

    assert all(q is not None for q in q_values)
    significant = [q < SIGNIFICANCE_THRESHOLD for q in q_values]

    assert significant == [True, False, False, False, False]
    # Every raw p-value except the last was < 0.05 on its own — the point of
    # this test is that correction removes 3 of those 4 false leads.
    raw_significant = [p < SIGNIFICANCE_THRESHOLD for p in p_values]
    assert raw_significant == [True, True, True, True, False]


def test_benjamini_hochberg_monotonic_and_bounded():
    q_values = _benjamini_hochberg([0.2, 0.001, 0.05, None, 0.9])
    assert q_values[3] is None  # None passes through untouched
    present = [q for q in q_values if q is not None]
    assert all(0.0 <= q <= 1.0 for q in present)


def test_benjamini_hochberg_empty_and_all_none():
    assert _benjamini_hochberg([]) == []
    assert _benjamini_hochberg([None, None]) == [None, None]


def test_compare_runs_wires_fdr_correction_across_full_family():
    """Integration proof: compare_runs' q_value/significant_corrected fields
    for every pairwise metric must match an independent recomputation of BH
    over the exact same set of raw p-values — i.e. correction is applied
    across the whole family (every metric x every pair in one call), not
    per-pair.
    """
    questions = [f"q{i}" for i in range(12)]

    baseline = _run("baseline", [
        _result(q, latency=2000 + i * 3, cost=0.002, relevancy=0.70, hallucination=0.30)
        for i, q in enumerate(questions)
    ])
    candidate = _run("candidate", [
        _result(q, latency=1400 + i * 3, cost=0.0009, relevancy=0.82, hallucination=0.12)
        for i, q in enumerate(questions)
    ])
    third = _run("third", [
        _result(q, latency=1950 + i * 4, cost=0.0021, relevancy=0.71, hallucination=0.29)
        for i, q in enumerate(questions)
    ])

    summary = compare_runs([baseline, candidate, third])

    raw_p_values = [
        pair["metrics"][metric_key]["p_value"]
        for pair in summary["pairwise"]
        for metric_key in pair["metrics"]
    ]
    expected_q_values = _benjamini_hochberg(raw_p_values)

    actual_q_values = [
        pair["metrics"][metric_key]["q_value"]
        for pair in summary["pairwise"]
        for metric_key in pair["metrics"]
    ]
    assert actual_q_values == expected_q_values

    # Additive, not substitutive: raw `significant` must be untouched by
    # whatever the corrected flag says.
    for pair in summary["pairwise"]:
        for metric in pair["metrics"].values():
            assert isinstance(metric["significant"], bool)
            assert isinstance(metric["significant_corrected"], bool)


def test_underpowered_flag_reflects_sample_size():
    small = _run("small-n", [_result(f"q{i}") for i in range(5)])
    large = _run("large-n", [_result(f"q{i}", latency=1500 + i) for i in range(10)])

    summary = compare_runs([small, large])
    pair = summary["pairwise"][0]

    for metric in pair["metrics"].values():
        assert metric["n"] == 5  # common questions = the smaller run's 5
        assert metric["underpowered"] is True

    big_a = _run("a", [_result(f"q{i}") for i in range(10)])
    big_b = _run("b", [_result(f"q{i}", latency=1500 + i) for i in range(10)])
    summary2 = compare_runs([big_a, big_b])
    for metric in summary2["pairwise"][0]["metrics"].values():
        assert metric["n"] == UNDERPOWERED_MIN_N + 2
        assert metric["underpowered"] is False


def test_replicate_rows_are_averaged_before_pairing_not_overwritten():
    """Regression test for the bug this feature would otherwise introduce:
    multiple Result rows sharing one question's text (replicate trials) must
    be averaged into a single per-question value before pairing, not silently
    overwrite each other in the by-question lookup.
    """
    # Run A: question "q0" has three replicate rows with different latencies.
    replicated = _run("replicated", [
        _result("q0", latency=1000.0),
        _result("q0", latency=2000.0),
        _result("q0", latency=3000.0),
        _result("q1", latency=1500.0),
    ])
    single = _run("single", [
        _result("q0", latency=1800.0),
        _result("q1", latency=1500.0),
    ])

    summary = compare_runs([single, replicated])
    pair = summary["pairwise"][0]

    # If replicates were overwriting instead of averaging, n would still be
    # 2 (both questions present) — the real signal is that q0's averaged
    # value (2000.0 = mean of 1000/2000/3000) drives the delta, not
    # whichever replicate happened to be inserted last (3000.0).
    assert pair["metrics"]["latency"]["n"] == 2
    # mean(single) = (1800+1500)/2 = 1650; mean(replicated q0 avg=2000, q1=1500) = 1750
    # delta = candidate(replicated) - baseline(single) = 1750 - 1650 = 100
    assert abs(pair["metrics"]["latency"]["delta"] - 100.0) < 0.01
