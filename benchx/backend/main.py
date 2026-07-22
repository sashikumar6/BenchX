"""
BenchX — FastAPI application entry point.

Exposes CRUD for experiments and datasets, kicks off + polls runs, and
computes statistical comparisons across completed runs.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.base import BaseHTTPMiddleware

from . import experiment_registry as registry
from .config import BACKEND_HOST, BACKEND_PORT, SUPPORTED_MODELS, get_provider_api_key, list_models_by_provider
from .database import RunStatus, async_session, get_session
from .experiment_runner import build_run_summary, run_experiment
from .models import (
    Comparison,
    ComparisonCreate,
    ComparisonHistoryCreate,
    ComparisonHistoryEntry,
    ComparisonSummary,
    Corpus,
    CorpusCreate,
    Dataset,
    DatasetCreate,
    Document,
    DocumentCreate,
    Experiment,
    ExperimentCreate,
    Run,
    RunCreate,
    RunDetail,
    RunStatusResponse,
)
from .progress import run_progress_hub
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


@app.get("/models")
async def list_models():
    return list_models_by_provider()


# ── Corpora (RAG knowledge bases) ───────────────────────────────────
@app.post("/corpora", response_model=Corpus)
async def create_corpus(data: CorpusCreate, session: AsyncSession = Depends(get_session)):
    return await registry.create_corpus(session, data)


@app.get("/corpora", response_model=list[Corpus])
async def list_corpora(session: AsyncSession = Depends(get_session)):
    return await registry.list_corpora(session)


@app.get("/corpora/{corpus_id}", response_model=Corpus)
async def get_corpus(corpus_id: UUID, session: AsyncSession = Depends(get_session)):
    corpus = await registry.get_corpus(session, corpus_id)
    if corpus is None:
        raise HTTPException(404, "Corpus not found")
    return corpus


@app.delete("/corpora/{corpus_id}")
async def delete_corpus(corpus_id: UUID, session: AsyncSession = Depends(get_session)):
    deleted = await registry.delete_corpus(session, corpus_id)
    if not deleted:
        raise HTTPException(404, "Corpus not found")
    return {"deleted": True}


@app.post("/corpora/{corpus_id}/documents", response_model=Document)
async def add_document(
    corpus_id: UUID, data: DocumentCreate, session: AsyncSession = Depends(get_session)
):
    document = await registry.add_document(session, corpus_id, data)
    if document is None:
        raise HTTPException(404, "Corpus not found")
    return document


# ── Experiments ──────────────────────────────────────────────────────
@app.post("/experiments", response_model=Experiment)
async def create_experiment(
    data: ExperimentCreate, session: AsyncSession = Depends(get_session)
):
    if data.type == "builtin" and data.model not in SUPPORTED_MODELS:
        raise HTTPException(400, f"Unsupported model '{data.model}'")
    if data.type == "external" and not data.endpoint_url:
        raise HTTPException(400, "External experiments require an endpoint URL")
    if data.corpus_id is not None:
        if data.type != "builtin":
            raise HTTPException(400, "RAG corpora are only supported for builtin experiments")
        if await registry.get_corpus(session, data.corpus_id) is None:
            raise HTTPException(404, "Corpus not found")
        if data.chunk_size is None or data.top_k is None:
            raise HTTPException(400, "RAG experiments require both chunk_size and top_k")
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
    if data.replicate_count < 1:
        raise HTTPException(400, "replicate_count must be at least 1")
    if experiment.type.value == "builtin":
        try:
            get_provider_api_key(SUPPORTED_MODELS[experiment.model]["provider"])
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc

    run = await registry.create_run(
        session,
        data.experiment_id,
        data.dataset_id,
        total_questions=len(dataset.questions) * data.replicate_count,
    )
    background_tasks.add_task(
        run_experiment,
        data.experiment_id,
        data.dataset_id,
        run.id,
        run_progress_hub,
        data.replicate_count,
    )
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


@app.websocket("/ws/runs/{run_id}")
async def run_progress_websocket(websocket: WebSocket, run_id: UUID):
    """Stream persisted per-question run updates to one connected client."""
    await websocket.accept()
    queue = await run_progress_hub.subscribe(run_id)
    try:
        async with async_session() as session:
            run = await registry.get_run(session, run_id)
        if run is None:
            await websocket.send_json(
                {"type": "error", "run_id": str(run_id), "message": "Run not found"}
            )
            await websocket.close(code=4404)
            return

        latest = run.results[-1] if run.results else None
        if run.status == RunStatus.completed:
            await websocket.send_json(
                {
                    "type": "completed",
                    "run_id": str(run_id),
                    "summary": build_run_summary(run.results),
                }
            )
            return
        if run.status == RunStatus.failed:
            await websocket.send_json(
                {
                    "type": "error",
                    "run_id": str(run_id),
                    "message": run.error or "Run failed",
                }
            )
            return

        await websocket.send_json(
            {
                "type": "progress",
                "run_id": str(run_id),
                "completed": run.completed_questions,
                "total": run.total_questions,
                "latest_result": (
                    {
                        "id": str(latest.id),
                        "question": latest.question,
                        "response": latest.response,
                        "latency_ms": latest.latency_ms,
                        "cost_usd": latest.cost_usd,
                        "relevancy_score": latest.relevancy_score,
                        "hallucination_score": latest.hallucination_score,
                    }
                    if latest is not None
                    else None
                ),
            }
        )
        while True:
            event = await queue.get()
            await websocket.send_json(event)
            if event["type"] in {"completed", "error"}:
                return
    except WebSocketDisconnect:
        return
    finally:
        await run_progress_hub.unsubscribe(run_id, queue)


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


# ── Project comparison history ───────────────────────────────────────
async def _history_entry(history, session: AsyncSession) -> ComparisonHistoryEntry:
    baseline_run = await registry.get_run(session, history.baseline_run_id)
    candidate_run = await registry.get_run(session, history.candidate_run_id)
    baseline_experiment = (
        await registry.get_experiment(session, baseline_run.experiment_id) if baseline_run else None
    )
    candidate_experiment = (
        await registry.get_experiment(session, candidate_run.experiment_id) if candidate_run else None
    )
    metrics = registry._history_metrics(
        history.comparison.summary, history.baseline_run_id, history.candidate_run_id
    )
    return ComparisonHistoryEntry(
        id=history.id,
        project_name=history.project_name,
        comparison_id=history.comparison_id,
        baseline_run_id=history.baseline_run_id,
        candidate_run_id=history.candidate_run_id,
        baseline_name=baseline_experiment.name if baseline_experiment else str(history.baseline_run_id),
        candidate_name=candidate_experiment.name if candidate_experiment else str(history.candidate_run_id),
        verdict=history.verdict,
        metrics_improved=history.metrics_improved,
        metrics_total=history.metrics_total,
        metrics=metrics,
        created_at=history.created_at,
    )


@app.get("/projects")
async def list_projects(session: AsyncSession = Depends(get_session)):
    return await registry.list_projects(session)


@app.post("/projects/{project_name}/history", response_model=ComparisonHistoryEntry)
async def save_project_history(
    project_name: str,
    data: ComparisonHistoryCreate,
    session: AsyncSession = Depends(get_session),
):
    project_name = project_name.strip()
    if not project_name:
        raise HTTPException(400, "Project name is required")
    comparison = await registry.get_comparison(session, data.comparison_id)
    if comparison is None:
        raise HTTPException(404, "Comparison not found")
    try:
        history = await registry.save_comparison_to_project(session, project_name, comparison)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return await _history_entry(history, session)


@app.get("/projects/{project_name}/history", response_model=list[ComparisonHistoryEntry])
async def project_history(project_name: str, session: AsyncSession = Depends(get_session)):
    history = await registry.list_project_history(session, project_name)
    return [await _history_entry(entry, session) for entry in history]


@app.get("/projects/{project_name}/trend")
async def project_trend(project_name: str, session: AsyncSession = Depends(get_session)):
    history = await registry.list_project_history(session, project_name)
    points = []
    for entry in history:
        metrics = registry._history_metrics(
            entry.comparison.summary, entry.baseline_run_id, entry.candidate_run_id
        )
        points.append(
            {
                "date": entry.created_at.isoformat(),
                "comparison_id": str(entry.comparison_id),
                "verdict": entry.verdict,
                **{key: value.get("delta") for key, value in metrics.items()},
            }
        )
    return {"project_name": project_name, "points": points}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host=BACKEND_HOST,
        port=BACKEND_PORT,
        reload=True,
    )
