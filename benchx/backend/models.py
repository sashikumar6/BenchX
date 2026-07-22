"""
BenchX Pydantic models — request/response schemas for the API.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict


# ── Corpora (RAG knowledge bases) ───────────────────────────────────
class CorpusCreate(BaseModel):
    name: str
    description: Optional[str] = None


class DocumentCreate(BaseModel):
    filename: str
    content: str


class Document(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    corpus_id: UUID
    filename: str
    content: str
    created_at: datetime


class Corpus(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: Optional[str] = None
    created_at: datetime
    documents: list[Document] = Field(default_factory=list)


# ── Experiments ──────────────────────────────────────────────────────
class ExperimentCreate(BaseModel):
    name: str
    model: str = "external-agent"
    type: Literal["builtin", "external"] = "builtin"
    endpoint_url: Optional[str] = None
    auth_header: Optional[str] = None
    temperature: float = 0.7
    max_tokens: int = 1000
    system_prompt: Optional[str] = None
    chunk_size: Optional[int] = None
    top_k: Optional[int] = None
    corpus_id: Optional[UUID] = None
    extra_params: Optional[dict[str, Any]] = None


class Experiment(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    model: str
    type: str
    endpoint_url: Optional[str] = None
    temperature: float
    max_tokens: int
    system_prompt: Optional[str] = None
    chunk_size: Optional[int] = None
    top_k: Optional[int] = None
    corpus_id: Optional[UUID] = None
    extra_params: Optional[dict[str, Any]] = None
    created_at: datetime
    status: str


# ── Datasets ─────────────────────────────────────────────────────────
class DatasetQuestion(BaseModel):
    question: str
    ground_truth: Optional[str] = None


class DatasetCreate(BaseModel):
    name: str
    questions: list[DatasetQuestion]


class Dataset(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    questions: list[DatasetQuestion]
    created_at: datetime


# ── Runs ─────────────────────────────────────────────────────────────
class RunCreate(BaseModel):
    experiment_id: UUID
    dataset_id: UUID
    replicate_count: int = 1


class Run(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    experiment_id: UUID
    dataset_id: UUID
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    status: str
    total_questions: int
    completed_questions: int
    error: Optional[str] = None


class RunStatusResponse(BaseModel):
    id: UUID
    status: str
    total_questions: int
    completed_questions: int
    error: Optional[str] = None


class Result(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    run_id: UUID
    question: str
    ground_truth: Optional[str] = None
    response: str
    latency_ms: float
    cost_usd: float
    relevancy_score: float
    hallucination_score: float
    hallucination_reason: Optional[str] = None
    tokens_input: int
    tokens_output: int
    retrieved_chunk_ids: Optional[list[dict[str, Any]]] = None
    created_at: datetime


class RunDetail(Run):
    results: list[Result] = Field(default_factory=list)


# ── Comparisons ──────────────────────────────────────────────────────
class ComparisonCreate(BaseModel):
    name: str
    run_ids: list[UUID]


class MetricStat(BaseModel):
    mean: float
    std: float


class RunSummary(BaseModel):
    run_id: UUID
    experiment_name: str
    model: str
    temperature: float
    system_prompt: Optional[str] = None
    dataset_name: str
    metrics: dict[str, MetricStat]
    verdict: str


class PairwiseMetric(BaseModel):
    delta: float
    p_value: Optional[float] = None
    significant: bool
    direction: str
    confidence_interval: Optional[list[float]] = None
    effect_size: float = 0.0
    interpretation: str = "negligible"
    q_value: Optional[float] = None
    significant_corrected: bool = False
    n: int = 0
    underpowered: bool = False


class PairwiseComparison(BaseModel):
    run_a: UUID
    run_b: UUID
    metrics: dict[str, PairwiseMetric]
    verdict: str


class ComparisonSummary(BaseModel):
    runs: list[RunSummary]
    pairwise: list[PairwiseComparison]


class Comparison(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    run_ids: list[UUID]
    summary: ComparisonSummary
    created_at: datetime


# ── Project comparison history ──────────────────────────────────────
class ComparisonHistoryCreate(BaseModel):
    comparison_id: UUID


class ComparisonHistoryEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_name: str
    comparison_id: UUID
    baseline_run_id: UUID
    candidate_run_id: UUID
    baseline_name: str
    candidate_name: str
    verdict: str
    metrics_improved: int
    metrics_total: int
    metrics: dict[str, dict[str, Any]]
    created_at: datetime
