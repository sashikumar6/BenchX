"""
BenchX experiment registry — async CRUD for experiments, datasets, runs,
and comparisons against PostgreSQL.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .database import Chunk, Comparison, ComparisonHistory, Corpus, Dataset, Document, Experiment, ExperimentStatus, ExperimentType, Result, Run, RunStatus
from .models import ComparisonCreate, CorpusCreate, DatasetCreate, DocumentCreate, ExperimentCreate
from .stats import make_json_serializable


# ── Corpora ──────────────────────────────────────────────────────────
async def create_corpus(session: AsyncSession, data: CorpusCreate) -> Corpus:
    corpus = Corpus(name=data.name, description=data.description)
    session.add(corpus)
    await session.commit()
    await session.refresh(corpus, attribute_names=["documents"])
    return corpus


async def list_corpora(session: AsyncSession) -> list[Corpus]:
    result = await session.execute(
        select(Corpus).options(selectinload(Corpus.documents)).order_by(Corpus.created_at.desc())
    )
    return list(result.scalars().all())


async def get_corpus(session: AsyncSession, corpus_id: UUID) -> Corpus | None:
    result = await session.execute(
        select(Corpus).where(Corpus.id == corpus_id).options(selectinload(Corpus.documents))
    )
    return result.scalar_one_or_none()


async def delete_corpus(session: AsyncSession, corpus_id: UUID) -> bool:
    corpus = await session.get(Corpus, corpus_id)
    if corpus is None:
        return False
    await session.delete(corpus)
    await session.commit()
    return True


async def add_document(session: AsyncSession, corpus_id: UUID, data: DocumentCreate) -> Document | None:
    corpus = await session.get(Corpus, corpus_id)
    if corpus is None:
        return None
    document = Document(corpus_id=corpus_id, filename=data.filename, content=data.content)
    session.add(document)
    # Invalidate every chunk_size variant already computed for this corpus —
    # the newly added document is missing from all of them. Cheap and
    # correct at this data scale; see ADR-020.
    await session.execute(delete(Chunk).where(Chunk.corpus_id == corpus_id))
    await session.commit()
    await session.refresh(document)
    return document


# ── Experiments ──────────────────────────────────────────────────────
async def create_experiment(session: AsyncSession, data: ExperimentCreate) -> Experiment:
    experiment = Experiment(
        name=data.name,
        model=data.model,
        type=ExperimentType(data.type),
        endpoint_url=data.endpoint_url,
        auth_header=data.auth_header,
        temperature=data.temperature,
        max_tokens=data.max_tokens,
        system_prompt=data.system_prompt,
        chunk_size=data.chunk_size,
        top_k=data.top_k,
        corpus_id=data.corpus_id,
        extra_params=data.extra_params,
        status=ExperimentStatus.configured,
    )
    session.add(experiment)
    await session.commit()
    await session.refresh(experiment)
    return experiment


async def list_experiments(session: AsyncSession) -> list[Experiment]:
    result = await session.execute(select(Experiment).order_by(Experiment.created_at.desc()))
    return list(result.scalars().all())


async def get_experiment(session: AsyncSession, experiment_id: UUID) -> Experiment | None:
    return await session.get(Experiment, experiment_id)


async def delete_experiment(session: AsyncSession, experiment_id: UUID) -> bool:
    experiment = await session.get(Experiment, experiment_id)
    if experiment is None:
        return False
    await session.delete(experiment)
    await session.commit()
    return True


async def set_experiment_status(
    session: AsyncSession, experiment_id: UUID, status: ExperimentStatus
) -> None:
    experiment = await session.get(Experiment, experiment_id)
    if experiment is not None:
        experiment.status = status
        await session.commit()


# ── Datasets ─────────────────────────────────────────────────────────
async def create_dataset(session: AsyncSession, data: DatasetCreate) -> Dataset:
    dataset = Dataset(
        name=data.name,
        questions=[q.model_dump() for q in data.questions],
    )
    session.add(dataset)
    await session.commit()
    await session.refresh(dataset)
    return dataset


async def list_datasets(session: AsyncSession) -> list[Dataset]:
    result = await session.execute(select(Dataset).order_by(Dataset.created_at.desc()))
    return list(result.scalars().all())


async def get_dataset(session: AsyncSession, dataset_id: UUID) -> Dataset | None:
    return await session.get(Dataset, dataset_id)


async def delete_dataset(session: AsyncSession, dataset_id: UUID) -> bool:
    dataset = await session.get(Dataset, dataset_id)
    if dataset is None:
        return False
    await session.delete(dataset)
    await session.commit()
    return True


# ── Runs ─────────────────────────────────────────────────────────────
async def create_run(
    session: AsyncSession, experiment_id: UUID, dataset_id: UUID, total_questions: int
) -> Run:
    run = Run(
        experiment_id=experiment_id,
        dataset_id=dataset_id,
        status=RunStatus.running,
        started_at=datetime.now(timezone.utc),
        total_questions=total_questions,
        completed_questions=0,
    )
    session.add(run)
    await session.commit()
    await session.refresh(run)
    return run


async def list_runs(session: AsyncSession) -> list[Run]:
    result = await session.execute(select(Run).order_by(Run.started_at.desc()))
    return list(result.scalars().all())


async def get_run(session: AsyncSession, run_id: UUID) -> Run | None:
    result = await session.execute(
        select(Run).where(Run.id == run_id).options(selectinload(Run.results))
    )
    return result.scalar_one_or_none()


async def add_result(session: AsyncSession, run_id: UUID, **fields) -> Result:
    result = Result(run_id=run_id, **fields)
    session.add(result)
    await session.commit()
    return result


async def increment_run_progress(session: AsyncSession, run_id: UUID) -> tuple[int, int]:
    """Atomically advance a run and return its new (completed, total) values."""
    result = await session.execute(
        update(Run)
        .where(Run.id == run_id)
        .values(completed_questions=Run.completed_questions + 1)
        .returning(Run.completed_questions, Run.total_questions)
    )
    await session.commit()
    row = result.one_or_none()
    return (int(row[0]), int(row[1])) if row is not None else (0, 0)


async def finish_run(session: AsyncSession, run_id: UUID, status: RunStatus, error: str | None = None) -> None:
    run = await session.get(Run, run_id)
    if run is not None:
        run.status = status
        run.completed_at = datetime.now(timezone.utc)
        run.error = error
        await session.commit()


async def list_runs_by_ids(session: AsyncSession, run_ids: list[UUID]) -> list[Run]:
    result = await session.execute(
        select(Run)
        .where(Run.id.in_(run_ids))
        .options(selectinload(Run.results), selectinload(Run.experiment), selectinload(Run.dataset))
    )
    runs = {run.id: run for run in result.scalars().all()}
    # Preserve the caller's ordering (first run = baseline for verdicts).
    return [runs[rid] for rid in run_ids if rid in runs]


# ── Comparisons ──────────────────────────────────────────────────────
async def create_comparison(
    session: AsyncSession, data: ComparisonCreate, summary: dict
) -> Comparison:
    comparison = Comparison(
        name=data.name,
        run_ids=[str(rid) for rid in data.run_ids],
        summary=make_json_serializable(summary),
    )
    session.add(comparison)
    await session.commit()
    await session.refresh(comparison)
    return comparison


async def list_comparisons(session: AsyncSession) -> list[Comparison]:
    result = await session.execute(select(Comparison).order_by(Comparison.created_at.desc()))
    return list(result.scalars().all())


async def get_comparison(session: AsyncSession, comparison_id: UUID) -> Comparison | None:
    return await session.get(Comparison, comparison_id)


# ── Project history ─────────────────────────────────────────────────
def _history_metrics(summary: dict, baseline_run_id: UUID, candidate_run_id: UUID) -> dict[str, dict]:
    pair = next(
        (
            item
            for item in summary.get("pairwise", [])
            if str(item.get("run_a")) == str(baseline_run_id)
            and str(item.get("run_b")) == str(candidate_run_id)
        ),
        {},
    )
    return pair.get("metrics", {})


async def save_comparison_to_project(
    session: AsyncSession, project_name: str, comparison: Comparison
) -> ComparisonHistory:
    run_ids = [UUID(str(run_id)) for run_id in comparison.run_ids]
    if len(run_ids) < 2:
        raise ValueError("A comparison needs at least two runs to save history")
    baseline_run_id, candidate_run_id = run_ids[:2]
    metrics = _history_metrics(comparison.summary, baseline_run_id, candidate_run_id)
    improved = sum(metric.get("direction") == "improved" for metric in metrics.values())
    history = ComparisonHistory(
        project_name=project_name,
        comparison_id=comparison.id,
        baseline_run_id=baseline_run_id,
        candidate_run_id=candidate_run_id,
        verdict=next(
            (
                pair.get("verdict", "INCONCLUSIVE")
                for pair in comparison.summary.get("pairwise", [])
                if str(pair.get("run_a")) == str(baseline_run_id)
                and str(pair.get("run_b")) == str(candidate_run_id)
            ),
            "INCONCLUSIVE",
        ),
        metrics_improved=improved,
        metrics_total=len(metrics),
    )
    session.add(history)
    await session.commit()
    await session.refresh(history)
    return history


async def list_projects(session: AsyncSession) -> list[str]:
    result = await session.execute(
        select(ComparisonHistory.project_name)
        .distinct()
        .order_by(ComparisonHistory.project_name.asc())
    )
    return list(result.scalars().all())


async def list_project_history(session: AsyncSession, project_name: str) -> list[ComparisonHistory]:
    result = await session.execute(
        select(ComparisonHistory)
        .where(ComparisonHistory.project_name == project_name)
        .options(selectinload(ComparisonHistory.comparison))
        .order_by(ComparisonHistory.created_at.asc())
    )
    return list(result.scalars().all())
