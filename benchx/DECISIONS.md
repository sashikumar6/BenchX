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
(`comparator.py` / `dynamic_agent.py`, still present but no longer wired into
the app). The ADRs below cover the persistent, PostgreSQL-backed experiment
tracking platform that superseded it: experiments and datasets are saved,
runs execute against them asynchronously, and any N completed runs can be
compared, not just a fixed baseline/candidate pair.

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
