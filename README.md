# BenchX

An experiment tracking and comparison platform for LLM applications. Configure
a model + prompt + optional retrieval setup as an **Experiment**, execute it
against a fixed question set as a **Run**, then **Compare** any two or more
completed runs to get a paired significance test — not just "these numbers
are different," but whether one is actually better or the difference is
noise. Comparisons can be saved to a **Project** to track a metric over time
across releases.

## What it measures

Per question: latency, cost, relevancy, and a hallucination score. Across
runs: paired delta, 95% confidence interval, Cohen's d effect size, and an
FDR-corrected p-value across the full metric family being compared.

## Features

- **Built-in models** — OpenAI, Anthropic, Groq, and NVIDIA-hosted models, or
  point an experiment at an **external agent** over HTTP.
- **RAG** — attach a knowledge base (uploaded `.txt`/`.md` docs) to an
  experiment; documents are chunked and embedded lazily on first use and
  retrieved via pgvector similarity search.
- **Live run progress** over a WebSocket, not polling.
- **Replicates** — repeat each question N times per run to average out
  temperature-driven noise before comparing.

## Stack

FastAPI + PostgreSQL (pgvector) on the backend, SQLAlchemy async + Alembic
for migrations; React + Vite + Tailwind on the frontend.

## Running locally

```bash
cp benchx/.env.example benchx/.env   # fill in at least one provider's API key
cd benchx
docker compose up -d                 # backend on :8000, postgres on :55433
cd frontend
npm install
npm run dev                          # frontend on :5173
```

`OPENAI_API_KEY` is required even if you're only testing other providers —
RAG's embedding step is hardcoded to OpenAI's `text-embedding-3-small`
regardless of which model an experiment uses for chat.

## Deploying

`render.yaml` at the repo root defines a Render Blueprint: the backend as a
Docker web service, the frontend as a static site. Needs a managed Postgres
with the `vector` extension enabled (e.g. Supabase) — Render's own free
Postgres tier expires after 30 days, which doesn't fit a long-running
deployment.

## Architecture decisions

See [`benchx/DECISIONS.md`](benchx/DECISIONS.md) for the ADRs behind the
schema, the WebSocket progress design, the statistics methodology, and the
RAG chunking approach.
