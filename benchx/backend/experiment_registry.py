"""
BenchX experiment registry — async CRUD for experiments, datasets, runs,
and comparisons against PostgreSQL.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .database import Comparison, Dataset, Experiment, ExperimentStatus, Result, Run, RunStatus
from .models import ComparisonCreate, DatasetCreate, ExperimentCreate
from .stats import make_json_serializable


# ── Experiments ──────────────────────────────────────────────────────
async def create_experiment(session: AsyncSession, data: ExperimentCreate) -> Experiment:
    experiment = Experiment(
        name=data.name,
        model=data.model,
        temperature=data.temperature,
        max_tokens=data.max_tokens,
        system_prompt=data.system_prompt,
        chunk_size=data.chunk_size,
        top_k=data.top_k,
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


async def increment_run_progress(session: AsyncSession, run_id: UUID) -> None:
    run = await session.get(Run, run_id)
    if run is not None:
        run.completed_questions += 1
        await session.commit()


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
