import { VERDICT_STYLES } from '../constants'

function countImprovedMetrics(pairwise, baselineId, runId) {
  const pair = pairwise.find((p) => p.run_a === baselineId && p.run_b === runId)
  if (!pair) return { improved: 0, total: 0 }
  const metrics = Object.values(pair.metrics)
  return { improved: metrics.filter((m) => m.direction === 'improved').length, total: metrics.length }
}

export default function VerdictBanner({ runs, pairwise }) {
  const baseline = runs[0]

  const best = runs
    .slice(1)
    .filter((r) => r.verdict === 'BEST')
    .map((r) => ({ run: r, ...countImprovedMetrics(pairwise, baseline.run_id, r.run_id) }))
    .sort((a, b) => b.improved - a.improved)[0]

  return (
    <div className="bg-bg-card border border-border rounded-2xl p-6">
      <div className="flex flex-wrap gap-3 mb-4">
        {runs.map((r) => {
          const style = VERDICT_STYLES[r.verdict] || VERDICT_STYLES.INCONCLUSIVE
          return (
            <div
              key={r.run_id}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${style.className}`}
            >
              <span className="text-sm font-semibold">{r.experiment_name}</span>
              <span className="text-[10px] uppercase tracking-wider font-bold">{style.label}</span>
            </div>
          )
        })}
      </div>

      {best ? (
        <p className="text-text-primary text-sm">
          🏆 <span className="font-semibold">{best.run.experiment_name}</span> wins on{' '}
          {best.improved}/{best.total} metrics (p&lt;0.05) vs baseline.
        </p>
      ) : (
        <p className="text-text-secondary text-sm">
          No experiment significantly outperforms the baseline across a majority of metrics.
        </p>
      )}
    </div>
  )
}
