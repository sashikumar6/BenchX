"""
BenchX — FastAPI application entry point.

Exposes CRUD for experiments and datasets, kicks off + polls runs, and
computes statistical comparisons across completed runs.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.base import BaseHTTPMiddleware

from . import experiment_registry as registry
from .config import BACKEND_HOST, BACKEND_PORT, SUPPORTED_MODELS
from .database import RunStatus, get_session
from .experiment_runner import run_experiment
from .models import (
    Comparison,
    ComparisonCreate,
    ComparisonSummary,
    Dataset,
    DatasetCreate,
    Experiment,
    ExperimentCreate,
    Run,
    RunCreate,
    RunDetail,
    RunStatusResponse,
)
from .stats import compare_runs

app = FastAPI(
    title="BenchX",
    description="LLM experiment tracking and comparison platform.",
    version="0.1.0",
)


class CatchAllMiddleware(BaseHTTPMiddleware):
    """Turn unhandled exceptions into plain JSON 500s.

    Registered *before* CORSMiddleware below so it wraps the router from the
    inside: Starlette's own `@app.exception_handler(Exception)` is installed
    into ServerErrorMiddleware, which sits outside all user middleware
    (including CORS) no matter the registration order, so its 500 responses
    never get CORS headers — the browser reports a CORS failure instead of
    the real error. Catching exceptions here, inside CORSMiddleware, lets
    the CORS headers still be attached to the resulting response.
    """

    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)
        except Exception:
            return JSONResponse(status_code=500, content={"detail": "Internal server error"})


app.add_middleware(CatchAllMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    # The frontend never sends cookies/auth headers, so credentials are off.
    # Browsers reject the combination of allow_origins=["*"] with
    # allow_credentials=True outright (the CORS spec forbids wildcard
    # origins on credentialed requests), which silently blocks every
    # request from the dev server.
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "benchx"}


# ── Experiments ──────────────────────────────────────────────────────
@app.post("/experiments", response_model=Experiment)
async def create_experiment(
    data: ExperimentCreate, session: AsyncSession = Depends(get_session)
):
    if data.model not in SUPPORTED_MODELS:
        raise HTTPException(400, f"Unsupported model '{data.model}'")
    return await registry.create_experiment(session, data)


@app.get("/experiments", response_model=list[Experiment])
async def list_experiments(session: AsyncSession = Depends(get_session)):
    return await registry.list_experiments(session)


@app.get("/experiments/{experiment_id}", response_model=Experiment)
async def get_experiment(experiment_id: UUID, session: AsyncSession = Depends(get_session)):
    experiment = await registry.get_experiment(session, experiment_id)
    if experiment is None:
        raise HTTPException(404, "Experiment not found")
    return experiment


@app.delete("/experiments/{experiment_id}")
async def delete_experiment(experiment_id: UUID, session: AsyncSession = Depends(get_session)):
    deleted = await registry.delete_experiment(session, experiment_id)
    if not deleted:
        raise HTTPException(404, "Experiment not found")
    return {"deleted": True}


# ── Datasets ─────────────────────────────────────────────────────────
@app.post("/datasets", response_model=Dataset)
async def create_dataset(data: DatasetCreate, session: AsyncSession = Depends(get_session)):
    if not data.questions:
        raise HTTPException(400, "Dataset must contain at least one question")
    return await registry.create_dataset(session, data)


@app.get("/datasets", response_model=list[Dataset])
async def list_datasets(session: AsyncSession = Depends(get_session)):
    return await registry.list_datasets(session)


@app.get("/datasets/{dataset_id}", response_model=Dataset)
async def get_dataset(dataset_id: UUID, session: AsyncSession = Depends(get_session)):
    dataset = await registry.get_dataset(session, dataset_id)
    if dataset is None:
        raise HTTPException(404, "Dataset not found")
    return dataset


@app.delete("/datasets/{dataset_id}")
async def delete_dataset(dataset_id: UUID, session: AsyncSession = Depends(get_session)):
    deleted = await registry.delete_dataset(session, dataset_id)
    if not deleted:
        raise HTTPException(404, "Dataset not found")
    return {"deleted": True}


# ── Runs ─────────────────────────────────────────────────────────────
@app.post("/runs", response_model=Run)
async def create_run(
    data: RunCreate,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
):
    experiment = await registry.get_experiment(session, data.experiment_id)
    if experiment is None:
        raise HTTPException(404, "Experiment not found")

    dataset = await registry.get_dataset(session, data.dataset_id)
    if dataset is None:
        raise HTTPException(404, "Dataset not found")

    run = await registry.create_run(
        session, data.experiment_id, data.dataset_id, total_questions=len(dataset.questions)
    )
    background_tasks.add_task(run_experiment, data.experiment_id, data.dataset_id, run.id)
    return run


@app.get("/runs", response_model=list[Run])
async def list_runs(session: AsyncSession = Depends(get_session)):
    return await registry.list_runs(session)


@app.get("/runs/{run_id}", response_model=RunDetail)
async def get_run(run_id: UUID, session: AsyncSession = Depends(get_session)):
    run = await registry.get_run(session, run_id)
    if run is None:
        raise HTTPException(404, "Run not found")
    return run


@app.get("/runs/{run_id}/status", response_model=RunStatusResponse)
async def get_run_status(run_id: UUID, session: AsyncSession = Depends(get_session)):
    run = await registry.get_run(session, run_id)
    if run is None:
        raise HTTPException(404, "Run not found")
    return RunStatusResponse(
        id=run.id,
        status=run.status,
        total_questions=run.total_questions,
        completed_questions=run.completed_questions,
        error=run.error,
    )


# ── Comparisons ──────────────────────────────────────────────────────
@app.post("/comparisons", response_model=Comparison)
async def create_comparison(
    data: ComparisonCreate, session: AsyncSession = Depends(get_session)
):
    if len(data.run_ids) < 2:
        raise HTTPException(400, "Select at least two runs to compare")

    runs = await registry.list_runs_by_ids(session, data.run_ids)
    if len(runs) != len(data.run_ids):
        raise HTTPException(404, "One or more runs not found")

    incomplete = [str(r.id) for r in runs if r.status != RunStatus.completed]
    if incomplete:
        raise HTTPException(400, f"Runs not completed yet: {', '.join(incomplete)}")

    runs_data = [
        {
            "run_id": run.id,
            "experiment_name": run.experiment.name,
            "model": run.experiment.model,
            "temperature": run.experiment.temperature,
            "system_prompt": run.experiment.system_prompt,
            "dataset_name": run.dataset.name,
            "results": run.results,
        }
        for run in runs
    ]

    summary = compare_runs(runs_data)
    comparison = await registry.create_comparison(session, data, summary)
    return Comparison(
        id=comparison.id,
        name=comparison.name,
        run_ids=data.run_ids,
        summary=ComparisonSummary(**summary),
        created_at=comparison.created_at,
    )


@app.get("/comparisons", response_model=list[Comparison])
async def list_comparisons(session: AsyncSession = Depends(get_session)):
    comparisons = await registry.list_comparisons(session)
    return [
        Comparison(
            id=c.id,
            name=c.name,
            run_ids=c.run_ids,
            summary=ComparisonSummary(**c.summary),
            created_at=c.created_at,
        )
        for c in comparisons
    ]


@app.get("/comparisons/{comparison_id}", response_model=Comparison)
async def get_comparison(comparison_id: UUID, session: AsyncSession = Depends(get_session)):
    comparison = await registry.get_comparison(session, comparison_id)
    if comparison is None:
        raise HTTPException(404, "Comparison not found")
    return Comparison(
        id=comparison.id,
        name=comparison.name,
        run_ids=comparison.run_ids,
        summary=ComparisonSummary(**comparison.summary),
        created_at=comparison.created_at,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host=BACKEND_HOST,
        port=BACKEND_PORT,
        reload=True,
    )
