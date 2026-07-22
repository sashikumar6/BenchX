# BenchX — Architecture Decision Records

---

## ADR-001: Why paired t-test over Mann-Whitney U

**Status:** Accepted  
**Date:** 2026-07-11  
**Context:**

We need a statistical test to determine whether the candidate agent is
significantly better (or worse) than the baseline agent across multiple
evaluation questions.

**Decision:**

We use the **paired t-test** (`scipy.stats.ttest_rel`) rather than the
Mann-Whitney U test.

**Rationale:**

- **Paired design.** Each question is evaluated by *both* agents, producing
  naturally paired observations. A paired t-test directly accounts for
  within-question variance, increasing statistical power.
- **Normality assumption is reasonable.** With 10+ questions and metric scores
  that are continuous (latency in ms, cost in USD, similarity 0-1), the
  Central Limit Theorem makes the normality assumption workable. For very
  small sample sizes we report confidence intervals alongside p-values so
  users can judge effect size.
- **Mann-Whitney U is unpaired.** It treats the two sets of observations as
  independent samples, discarding the pairing information. This wastes
  statistical power and can yield misleading results when question difficulty
  varies widely.

**Consequences:**

- If a user provides <5 questions, significance results should be interpreted
  cautiously (we warn about this in the UI).
- We could add a Wilcoxon signed-rank test as a non-parametric fallback in
  the future if distribution assumptions are violated.

---

## ADR-002: Why asyncio.gather for simultaneous agent calls

**Status:** Accepted  
**Date:** 2026-07-11  
**Context:**

When comparing baseline and candidate agents, we need to call both for each
question. Calling them sequentially would double total latency and could
introduce temporal confounds (e.g. one agent benefits from warmer caches).

**Decision:**

We use `asyncio.gather` to call both agents **simultaneously** for each
question.

**Rationale:**

- **Fair latency comparison.** Both agents are called at the same wall-clock
  instant, so network conditions and API load are as similar as possible.
- **Halves wall-clock time.** Instead of waiting for baseline *then* candidate,
  both complete in parallel.
- **Natural fit for FastAPI.** FastAPI is async-native, so `asyncio.gather` is
  idiomatic and introduces no additional dependencies.

**Consequences:**

- Concurrent requests may trigger rate-limiting on the OpenAI API if the
  question set is very large. We may need to add concurrency throttling
  (e.g. `asyncio.Semaphore`) in the future.

---

## ADR-003: Why embedding similarity for relevancy over ROUGE/BLEU

**Status:** Accepted  
**Date:** 2026-07-11  
**Context:**

We need a metric that measures how relevant an agent's response is to the
question (and optionally to a ground-truth answer).

**Decision:**

We use **cosine similarity between OpenAI embeddings**
(`text-embedding-3-small`) rather than ROUGE or BLEU scores.

**Rationale:**

- **Semantic, not lexical.** ROUGE and BLEU measure n-gram overlap, which
  penalises paraphrases and rewards superficial token matches. Embedding
  similarity captures *meaning* — a paraphrased correct answer scores high,
  while a token-similar but incorrect answer scores low.
- **Works without ground truth.** When no expected answer is provided, we fall
  back to question-response similarity. ROUGE/BLEU are meaningless in this
  setting because the question and answer share almost no tokens.
- **Model-aligned.** Using the same provider's (OpenAI) embedding model ensures
  the semantic space is compatible with the generation model's outputs.

**Consequences:**

- Adds an extra API call per response (embedding). This is cheap
  ($0.02/1M tokens) and fast, but adds latency.
- Embedding similarity may not capture fine-grained factual correctness —
  that's why we also have the hallucination evaluator.

---

## ADR-004: Why mock agents share the same model but differ in temperature + system prompt

**Status:** Accepted  
**Date:** 2026-07-11  
**Context:**

We need two "versions" of an agent to demonstrate the A/B testing framework.
Real users will plug in their own agents, but we need realistic mocks for
development and demos.

**Decision:**

Both mock agents use **GPT-4o-mini** but differ in:
- **Temperature:** baseline = 0.7 (higher variance), candidate = 0.3 (focused)
- **System prompt:** baseline has none, candidate has a strict
  financial-advisor prompt

**Rationale:**

- **Realistic simulation.** In practice, teams iterate on the same base model
  by tuning prompts, temperature, and system instructions — not by swapping
  to an entirely different model. This mirrors real-world agent development.
- **Observable differences.** The temperature and prompt differences produce
  measurably different outputs: the candidate should be more concise, more
  accurate, and less prone to hallucination — exactly the kind of signal
  BenchX is designed to detect.
- **Cost control.** Using the same cheap model for both avoids burning through
  API credits during development.

**Consequences:**

- The demo always uses GPT-4o-mini pricing; real deployments would need
  configurable pricing per model.
- The differences are subtle enough that small sample sizes may not achieve
  statistical significance — this is by design, as it demonstrates when
  "INCONCLUSIVE" is the correct verdict.

---

## ADR-005: Why verdict requires statistical significance, not just raw delta

**Status:** Accepted  
**Date:** 2026-07-11  
**Context:**

After computing metric deltas (candidate - baseline), we need to render a
ship/don't-ship recommendation.

**Decision:**

The verdict is based on **statistically significant** differences (p < 0.05),
not raw deltas.

**Rationale:**

- **Avoids false confidence.** A candidate that scores 0.01 better on
  relevancy across 3 questions is *not* meaningfully better — that delta is
  well within noise. Requiring significance prevents teams from shipping
  based on random fluctuations.
- **Calibrated risk.** A p < 0.05 threshold means there's less than a 5%
  chance the observed improvement is due to chance. This is the standard
  threshold in A/B testing across the industry.
- **Directional clarity.** Raw deltas can be misleading when variance is high.
  The t-test accounts for variance, so "significant + positive delta" is a
  much stronger signal than "positive delta" alone.

**Consequences:**

- Small sample sizes (< 5 questions) will rarely achieve significance, leading
  to more "INCONCLUSIVE" verdicts. This is the correct, conservative behavior.
- Users who want to override the significance threshold can do so via config.

---

# BenchX Platform — Experiment Tracking & N-Way Comparison

The ADRs above covered the original stateless, two-agent `/compare` prototype
(`comparator.py` / `dynamic_agent.py`). Those files, and the frontend
components that only they used (`AgentConfigPanel.jsx`, `RunComparison.jsx`,
`MetricsDashboard.jsx`), have since been deleted — they were dead code,
unreferenced by the app and importing names that no longer exist in
`models.py`/`stats.py`. The ADRs below cover the persistent, PostgreSQL-backed
experiment tracking platform that superseded the prototype: experiments and
datasets are saved, runs execute against them asynchronously, and any N
completed runs can be compared, not just a fixed baseline/candidate pair.

---

## ADR-006: Why paired t-test over Mann-Whitney U (N-way comparisons)

**Status:** Accepted
**Date:** 2026-07-11
**Context:**

`stats.compare_runs` now compares any number of completed runs pairwise,
rather than a fixed baseline/candidate pair. Each pairwise comparison still
needs a hypothesis test per metric.

**Decision:**

Every pairwise comparison uses `scipy.stats.ttest_rel`, matching per-question
scores by question text between the two runs.

**Rationale:**

- **Pairing survives generalization to N runs.** As long as two runs share
  common questions (typically because they ran the same dataset), their
  scores remain naturally paired — the pairing doesn't depend on there being
  exactly two runs in the whole comparison, only two in each pair.
- **Consistent statistical semantics across the whole comparison.** Using the
  same test for every pair (Exp1-vs-Exp2, Exp1-vs-Exp3, Exp2-vs-Exp3, ...)
  keeps p-values and confidence intervals comparable across the comparison
  matrix.
- **Mann-Whitney U would need to discard the pairing** to treat each pair as
  independent samples, which throws away power and reintroduces the
  question-difficulty confound the paired design was built to avoid.

**Consequences:**

- If two runs were evaluated against different datasets, only their common
  questions (matched by text) are used for the paired test; runs with no
  overlapping questions produce a pairwise entry with no metrics.

---

## ADR-007: Why asyncio.gather + Semaphore(5) for run execution

**Status:** Accepted
**Date:** 2026-07-11
**Context:**

A run now executes every question in a dataset against one experiment
configuration, potentially dozens or hundreds of questions, instead of just
calling two agents per question.

**Decision:**

`experiment_runner.run_experiment` fires all questions concurrently via
`asyncio.gather`, bounded by `asyncio.Semaphore(MAX_CONCURRENT_REQUESTS=5)`.

**Rationale:**

- **Throughput without rate-limit failures.** Unbounded concurrency against
  OpenAI/Anthropic/Groq on a 50+ question dataset trips provider rate limits;
  a semaphore caps in-flight requests to a safe, tunable number while still
  running far faster than sequential execution.
- **Per-question isolation.** Each question's call + evaluation is wrapped in
  its own try/except inside the semaphore-guarded task, so one failing
  question (bad completion, evaluator error) doesn't abort the rest of the
  run — it's recorded as a failed result and progress still advances.
- **Progress reporting falls out for free.** Because each task writes its own
  result row and increments `completed_questions` on completion, the
  `/runs/{id}/status` polling endpoint reflects true progress without extra
  bookkeeping.

**Consequences:**

- `MAX_CONCURRENT_REQUESTS` is a single global constant, not per-provider —
  a dataset that mixes providers doesn't currently get independent
  concurrency budgets per provider.

---

## ADR-008: Why embedding similarity over ROUGE/BLEU for relevancy

**Status:** Accepted
**Date:** 2026-07-11
**Context:**

Same requirement as before: score how relevant a response is to the
question (or ground truth), now computed once per stored `Result` row.

**Decision:**

Cosine similarity over `text-embedding-3-small` embeddings, with embeddings
cached by SHA-256 text hash for the lifetime of the process.

**Rationale:**

- **Semantic, not lexical**, for the same reasons as the original prototype:
  paraphrases score correctly, and the no-ground-truth fallback
  (question-vs-response similarity) is only meaningful semantically.
- **Caching matters more now.** A run reuses the same dataset's questions
  (and often the same ground truths) across every question's relevancy call,
  and a comparison may re-run the same dataset across many experiments — the
  hash-keyed cache avoids re-embedding identical text within a process
  lifetime.

**Consequences:**

- The in-memory cache is per-process and unbounded; a very large, diverse
  corpus of datasets could grow it without bound. Acceptable at current
  scale — would move to a bounded LRU or Redis cache if that changes.

---

## ADR-009: Why PostgreSQL + JSONB over SQLite for experiment storage

**Status:** Accepted
**Date:** 2026-07-11
**Context:**

The platform now persists experiments, datasets, runs, results, and
comparisons instead of returning a single ephemeral response.

**Decision:**

PostgreSQL via `asyncpg`, with `JSONB` columns for variable-shape data
(`extra_params`, dataset `questions`, comparison `summary`).

**Rationale:**

- **True async driver.** `asyncpg` gives a real non-blocking driver under
  SQLAlchemy's async engine; SQLite's async support is a thin wrapper over a
  fundamentally synchronous, single-writer file format that would serialize
  concurrent run writes.
- **JSONB fits genuinely variable-shape fields.** `extra_params` on an
  experiment, a dataset's `questions` array, and a comparison's full
  statistical `summary` don't have a fixed column shape across use cases;
  JSONB stores them queryably without a rigid schema, something SQLite's
  JSON1 extension supports far more weakly (no indexing, no `->`/`->>`
  operators).
- **Concurrent runs need real concurrency.** Multiple runs can be executing
  simultaneously, each writing a `Result` row per question; Postgres's MVCC
  handles concurrent writers correctly where SQLite would serialize or lock.

**Consequences:**

- Local development requires a running Postgres instance (via
  `docker-compose` or a local install) instead of a zero-config file — an
  acceptable tradeoff for a tool meant to track long-lived experiment
  history, not a quick script.

---

## ADR-010: Why verdicts require statistical significance, not raw delta

**Status:** Accepted
**Date:** 2026-07-11
**Context:**

Same principle as the original prototype, now applied per pairwise
comparison and rolled up into each run's overall BEST/WORST/MIXED/BASELINE
verdict in `stats.compare_runs`.

**Decision:**

A metric only counts as "improved" or "degraded" for verdict purposes when
its pairwise p-value is below `SIGNIFICANCE_THRESHOLD` (0.05); non-significant
deltas count as "inconclusive" and don't move a run's verdict off BASELINE
semantics for that metric.

**Rationale:**

- **Same false-confidence risk, now multiplied across metrics.** With four
  metrics compared pairwise across every pair of runs, requiring significance
  per metric prevents a run from being crowned BEST or WORST off noise in a
  single metric.
- **A run's overall verdict is anchored to the baseline (first selected
  run), not every other run.** BEST/WORST/MIXED/INCONCLUSIVE is computed from
  that run's significant metric directions versus the baseline specifically —
  this matches how the UI presents it (one reference column, N candidate
  columns) and keeps the verdict interpretable as "should I ship this instead
  of what I'm already running."

**Consequences:**

- A run can look better on raw numbers than the baseline across all four
  metrics and still verdict as INCONCLUSIVE if none of those deltas clear
  p<0.05 — this is intentional, not a bug, and is called out in the UI via
  the p-value shown on each metric card.

---

## ADR-011: Why per-question result storage over aggregate-only

**Status:** Accepted
**Date:** 2026-07-11
**Context:**

Each run could, in principle, store only aggregate metrics (mean latency,
mean cost, etc.) rather than one `Result` row per question.

**Decision:**

Every question in a run gets its own persisted `Result` row (question,
response, all four metric scores, token counts, hallucination reason).

**Rationale:**

- **Paired statistical tests require it.** `ttest_rel` needs matched
  per-question observations between two runs; aggregate-only storage would
  make every pairwise comparison mathematically impossible, not just less
  detailed.
- **The Question Explorer and per-run results table depend on it.** Seeing
  an individual response, its ground truth, and its hallucination reason
  side-by-side across experiments is a core BenchX workflow, not an
  afterthought.
- **Debugging regressions needs the raw response.** An aggregate mean
  hallucination score going up tells you *that* something regressed; only
  the per-question rows tell you *which* questions and *why* (via the judge's
  stored `reason`).

**Consequences:**

- Storage grows linearly with `experiments × dataset size`, which is the
  right tradeoff for a tool whose entire value proposition is being able to
  go back and inspect exactly what changed between two configurations.

---

## ADR-012: Why polling over WebSockets for run progress

**Status:** Accepted
**Date:** 2026-07-11
**Context:**

The frontend needs to reflect a run's progress (`completed_questions` /
`total_questions`) while it's executing, both in the Runs list and on the
Run Detail page.

**Decision:**

`GET /runs/{id}/status` (and, for the detail page, the full `GET /runs/{id}`)
is polled every 2 seconds from the frontend while a run's status is
`running`; no WebSocket or SSE channel is used.

**Rationale:**

- **Progress is coarse-grained by nature.** A run advances one question at a
  time, bounded by `Semaphore(5)`; sub-second granularity has no value, so a
  2-second poll loses nothing a push channel would deliver, while avoiding
  the server complexity of connection lifecycle, backpressure, and
  reconnect-on-drop that a WebSocket channel would add for no perceptible
  UX gain at this granularity.
- **FastAPI's request/response model stays uniform.** Every other endpoint in
  the API is plain request/response; adding one WebSocket endpoint would
  introduce a second connection model, second auth story, and second set of
  edge cases (reconnect, multiplexing multiple watched runs) for a single
  feature.
- **Polling composes with `BackgroundTasks` cleanly.** The run executes as a
  FastAPI background task in the same process that already owns the DB
  session factory; polling reads the same rows that task is writing, with no
  need for a pub/sub layer to bridge "run progress" to "connected clients."

**Consequences:**

- With many simultaneous running runs open in browser tabs, polling load
  scales with `open tabs × 0.5 req/s` — acceptable at BenchX's expected
  scale (a handful of concurrent runs per user), and easy to move to SSE or
  WebSockets later without changing the underlying `/runs/{id}/status`
  contract.

---

## ADR-013: UUID serialization strategy for JSONB storage

**Status:** Accepted
**Date:** 2026-07-13
**Context:**

Comparison summaries contain UUID run identifiers and statistical values that
can be non-finite. PostgreSQL JSONB accepts only JSON-compatible primitives,
so passing the raw Python summary can fail when SQLAlchemy binds the insert.

**Decision:**

Before persisting a comparison summary, recursively convert UUID values to
strings and convert `NaN` or infinite floats to `null` using
`stats.make_json_serializable`.

**Rationale:**

- JSONB stays portable and directly queryable without a custom encoder on
  every database write path.
- UUID strings are compatible with the API's Pydantic UUID fields when the
  comparison is read back.
- `null` is valid JSON and avoids an otherwise invalid response when a
  statistical calculation has no finite value.

**Consequences:**

- Stored summaries use string UUIDs; Python UUID objects are reconstructed by
  the response schema when needed.
- New JSONB summary fields should use the same utility before persistence.

---

## ADR-014: Why WebSockets replace polling for run progress

**Status:** Accepted
**Date:** 2026-07-13
**Context:**

The initial platform polled run status every two seconds. That cadence hid
per-question results, added repeated HTTP reads, and made progress feel
delayed during an active benchmark.

**Decision:**

Use a per-run WebSocket endpoint backed by an in-process fan-out hub. The
runner publishes a progress event after each persisted result, then sends a
terminal completed or error event. The database remains the source of truth
for reconnecting clients.

**Rationale:**

- A push event contains both the exact progress count and the latest result,
  enabling a live table without periodic full-run reads.
- Fan-out queues let several browser tabs watch one run without putting a
  browser WebSocket object into the persistence layer.
- Reconnects are safe: a client hydrates from `GET /runs/{id}` and then
  resumes the WebSocket stream, so an in-memory event is never the only copy
  of benchmark data.

**Consequences:**

- The event hub is process-local. Multi-instance deployment will need a
  shared broker such as Redis while keeping the event format unchanged.

---

## ADR-015: Why report effect size alongside p-value

**Status:** Accepted
**Date:** 2026-07-13
**Context:**

A p-value says whether an observed difference is unlikely under the null
hypothesis; it does not communicate the practical size of the difference.

**Decision:**

Report the paired delta, a 95% t confidence interval, and Cohen's d using
the pooled sample standard deviation. Classify the absolute d as negligible,
small, medium, or large.

**Rationale:**

- Confidence intervals show a plausible range for the true per-question
  difference instead of a binary significant/not-significant label.
- Effect size makes a tiny but statistically significant difference visibly
  distinct from a meaningful regression or improvement.

**Consequences:**

- Degenerate zero-variance samples report a zero effect size rather than an
  unbounded value, keeping JSON and the UI robust.

---

## ADR-016: External agent protocol design

**Status:** Accepted
**Date:** 2026-07-13
**Context:**

BenchX must evaluate deployed FastAPI and RAG agents, not only provider SDK
calls configured inside BenchX.

**Decision:**

External experiments make an async HTTP POST to a configured endpoint with
`{"question": "..."}` and optionally an `Authorization: Bearer` header. A
successful response supplies `{"answer": "...", "tokens_used": 150}`;
token usage is estimated from text if omitted. Calls have a 30-second timeout
and external cost is recorded as zero because provider pricing is unknown.

**Rationale:**

- The protocol is intentionally minimal and fits common FastAPI agent APIs.
- A bounded timeout isolates a failed endpoint to one question rather than
  blocking the rest of a concurrent run.

**Consequences:**

- Custom request and response shapes need an adapter in a future version;
  the stable base protocol keeps initial integration zero-config.

---

## ADR-017: Project-scoped comparison history design

**Status:** Accepted
**Date:** 2026-07-13
**Context:**

One-off comparisons cannot show whether iterative work improves an agent over
time.

**Decision:**

Persist a lightweight `comparison_history` record under a user-provided
project name. It references the immutable comparison and its baseline and
candidate runs, while storing the verdict and metric count needed for fast
timeline display.

**Rationale:**

- Reusing the existing comparison summary avoids duplicating per-question
  data or allowing historical values to drift.
- Project tags keep unrelated agents separate without introducing a new
  project lifecycle before users need one.

**Consequences:**

- Trends are computed from saved comparison summaries. A future project table
  can add ownership and descriptions without changing stored history rows.

---

## ADR-018: Why support four model providers

**Status:** Accepted
**Date:** 2026-07-13
**Context:**

Useful evaluation requires meaningful alternatives. A single-provider model
picker limits comparisons to prompt and temperature changes, even when the
largest practical change may be a model with a different price, context
window, latency profile, or reasoning capability.

**Decision:**

BenchX exposes metadata-driven OpenAI, Anthropic, Groq, and NVIDIA model
registries through `GET /models`. OpenAI-compatible providers share one call
path, Anthropic retains its SDK-specific message shape, and runs validate that
the selected provider key is configured before starting.

**Rationale:**

- Diversity creates real cost/quality tradeoffs rather than cosmetic
  single-provider comparisons.
- A backend registry keeps model pricing and context metadata consistent
  between validation, execution, cost calculation, and the frontend picker.
- Early credential validation gives an actionable configuration error instead
  of allowing a background run to fail with an opaque provider exception.

**Consequences:**

- Model availability and pricing should be reviewed as providers deprecate or
  change offerings; the single registry makes that maintenance localized.

---

## ADR-019: Why pgvector over an in-memory/numpy brute-force vector store

**Status:** Accepted
**Date:** 2026-07-16
**Context:**

The RAG pipeline needs to store chunk embeddings and retrieve the top-k
nearest to a question's embedding. Two realistic options: keep embeddings as
JSONB arrays and loop cosine similarity in Python, or use a real vector
extension on the Postgres instance the app already depends on.

**Decision:**

Use `pgvector` (`pgvector/pgvector:pg15` image, `Vector(1536)` column via
`pgvector.sqlalchemy`, an HNSW cosine-ops index, retrieval via
`Chunk.embedding.cosine_distance(...)` in the ORM).

**Rationale:**

- **Zero new infrastructure.** The stack is already fully Dockerized
  Postgres; swapping the image is a one-line change, not a new service to
  operate.
- **It's the production-standard pattern**, and demonstrating it —
  `CREATE EXTENSION vector`, a real ANN index, retrieval expressed through
  the ORM's query builder rather than a hand-rolled loop — is worth more as a
  signal of RAG infrastructure competence than the numpy alternative, which
  reads as a toy in-memory implementation.
- **Honesty check, stated plainly rather than implied:** at BenchX's actual
  scale (tens to low hundreds of chunks per `(corpus_id, chunk_size)` pair),
  an HNSW index has no measurable speed advantage over a sequential scan —
  this choice is not "we needed it for performance," it's "we used the
  correct architecture even though this specific dataset doesn't yet need it."
  Claiming otherwise would be a misleading claim about a demo-scale system.

**Consequences:**

- Local development and CI both require the pgvector-enabled Postgres image;
  a bare `postgres:15` will fail migration `0003` at `CREATE EXTENSION vector`.
- If BenchX ever needed true production scale (millions of chunks), pgvector
  itself scales there too — this decision doesn't need to be revisited, only
  the index tuning would.

---

## ADR-020: Why chunks are keyed by (corpus_id, chunk_size) and lazily cached

**Status:** Accepted
**Date:** 2026-07-16
**Context:**

`chunk_size` and `top_k` existed on `Experiment` since the original schema
but were never read by anything — pure decoration. Making them real requires
deciding what "chunking" is a property of: the corpus alone, or the
combination of corpus and chunk size.

**Decision:**

`Chunk` rows are keyed by `(corpus_id, chunk_size, document_id, chunk_index)`.
`rag.ensure_chunks(session, corpus_id, chunk_size)` computes and persists
chunks for a given pair on first use and reuses them afterward; it's called
once at the start of `run_experiment`, not lazily inside the concurrent
per-question tasks.

**Rationale:**

- **Chunking is genuinely a property of the pair, not the corpus alone.**
  Two experiments pointed at the same corpus with `chunk_size=256` vs.
  `chunk_size=1024` must retrieve from different chunk boundaries, or
  comparing chunk sizes would be cosmetic — the whole point of this feature
  is that the comparison is real.
- **This makes "does chunk_size=256 beat chunk_size=1024" a normal
  BenchX experiment comparison**, reusing `/comparisons` and the existing
  paired-t-test engine unchanged — RAG configuration is just another
  experiment dimension, not a new feature surface.
- **Chunking once at run-start, not per-question, avoids a real race.**
  `MAX_CONCURRENT_REQUESTS=5` concurrent `_process_question` tasks could
  otherwise all discover a brand-new `(corpus_id, chunk_size)` pair
  simultaneously and each try to chunk+embed+insert it, producing duplicate
  rows. A single check-and-populate before the concurrent tasks start avoids
  that entirely.
- **Word-count chunking, not a real tokenizer.** `chunk_text` packs
  paragraphs to ~chunk_size *words* with ~17.5% overlap, no `tiktoken`
  dependency. This is an approximation (a chunk_size=256 chunk is roughly
  ~330-350 GPT tokens, not exactly 256), which is fine because chunk_size is
  only ever compared *relatively* within BenchX (256 vs. 1024 against the
  same corpus), never against an external token budget.

**Consequences:**

- Adding a document to a corpus after chunks already exist for some
  `chunk_size` would leave those cached chunks stale (missing the new
  document); `add_document` handles this by deleting every `Chunk` row for
  that `corpus_id` (all `chunk_size` variants), so the next
  `ensure_chunks` call re-chunks the whole corpus fresh. Correct and cheap
  at this data scale.
- Every new `(corpus_id, chunk_size)` combination a user tries pays a
  one-time embedding cost on first run; subsequent runs against the same
  pair are effectively free.

---

## ADR-021: Why FDR correction is additive across the whole comparison family

**Status:** Accepted
**Date:** 2026-07-16
**Context:**

`compare_runs` runs one independent paired t-test per metric per run-pair —
up to `C(n,2) x 4` tests in a single comparison. None of them were corrected
for multiple comparisons: at a flat alpha=0.05, comparing enough
experiments/metrics at once makes some "significant" results just noise.

**Decision:**

Apply Benjamini-Hochberg FDR correction (implemented directly in `stats.py`,
~15 lines of numpy — no `statsmodels` dependency) across every `(pair,
metric)` p-value produced within one `compare_runs()` call. Each pairwise
metric gains `q_value` and `significant_corrected` *alongside* the existing
`p_value`/`significant` — the raw fields are never overwritten, and
`_direction`/`_pairwise_verdict`/`_run_verdict` (and
`experiment_registry._history_metrics`, which reads `direction`) keep using
the raw, uncorrected result.

**Rationale:**

- **The "family" for correction is the whole comparison, not each pair in
  isolation.** A user comparing 3 runs across 4 metrics is implicitly running
  12 hypothesis tests in one sitting; that's the unit FDR control should be
  applied over, not each pair's 4 tests independently (which would
  under-correct as more runs are added to the same comparison).
- **Additive, not substitutive, on purpose.** Silently swapping the raw
  result for the corrected one would hide *why* a result stopped being
  "significant," which defeats the point of a portfolio project meant to
  demonstrate the reasoning, not just the output. Showing both makes the
  correction legible and lets a viewer see exactly which findings survive
  scrutiny.
- **Manual implementation over `statsmodels`.** The step-up BH procedure is
  ~15 lines and well-understood; pulling in `statsmodels` (which drags in
  `pandas`/`patsy`) for one function would be a disproportionate dependency
  for what it buys.
- **Verdicts stay anchored to the raw test deliberately.** Changing verdict
  logic to use the corrected result would be a legitimate alternative
  design, but was rejected here to keep this a strictly additive change with
  zero risk to existing pairwise/run verdict behavior.

**Consequences:**

- A metric can show "✅ significant (raw)" and "— not significant (FDR
  corrected)" side by side — this is intentional and the more honest of the
  two signals when many things are being compared at once.
- A lightweight `underpowered` flag (`n < UNDERPOWERED_MIN_N = 8` paired
  observations) rides alongside, reusing data already computed — not a
  formal power analysis, just a cheap, honest "small sample, interpret with
  extra caution" signal.

---

## ADR-022: Why replicated trials are averaged before pairing, not modeled

**Status:** Accepted
**Date:** 2026-07-16
**Context:**

Every run executes each question exactly once. Pairing controls for
question-level difficulty variance, but not for the fact that a single LLM
call at nonzero temperature is one noisy draw from a distribution of
possible outputs. Comparing configurations (chunk_size, prompt, model) at
meaningfully nonzero temperature risks a "significant" result that's really
just favorable sampling in one run, not a true effect of the thing being
tested.

**Decision:**

`POST /runs` accepts an optional `replicate_count` (default 1, preserving
today's exact behavior). When greater than 1, the runner executes each
question that many times independently. `stats.py` groups all `Result` rows
sharing a question's text within a run and *averages* each metric across
them before that question enters the paired comparison — the paired t-test
itself is completely unchanged, it just receives a less noisy input.

**Rationale:**

- **Averaging is the honest minimal fix, not a full repeated-measures
  model.** A proper treatment would model between-question and
  within-question (replicate) variance separately, e.g. a mixed-effects
  design. That's real statistical machinery this project doesn't build.
  Averaging reduces sampling noise via the law of large numbers without
  claiming to be more rigorous than it is — the ADR says so explicitly
  rather than letting a viewer assume otherwise.
- **No schema change required.** A replicate is just another `Result` row
  sharing a question's text; `Result` already supported that structurally,
  the only real bug it would otherwise cause is `by_question` silently
  overwriting earlier replicates instead of aggregating them — fixed here.
- **Zero risk to existing runs.** `replicate_count=1` (the default) makes
  the averaging step a no-op — one value averaged with itself is itself —
  so every run created before this feature existed behaves identically.

**Consequences:**

- Replicates multiply LLM calls linearly (`questions x replicate_count`) —
  proportionally more cost and run time. The Run modal surfaces the total
  call count before starting so this is never a surprise.
- Replicates matter when temperature is meaningfully above 0 *and* the
  thing being compared is something other than temperature itself (chunk
  size, prompt, model). At temperature≈0, or when temperature is the
  variable under test, replicates add cost without adding signal.
