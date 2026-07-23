import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { METRIC_INFO } from '../constants'

const BASELINE_COLOR = '#6366f1'
const IMPROVED_COLOR = '#22c55e'
const DEGRADED_COLOR = '#ef4444'
const NEUTRAL_COLOR = '#6b7280'

function barColor(isBaseline, direction) {
  if (isBaseline) return BASELINE_COLOR
  if (direction === 'improved') return IMPROVED_COLOR
  if (direction === 'degraded') return DEGRADED_COLOR
  return NEUTRAL_COLOR
}

function findPairwiseVsBaseline(pairwise, baselineId, runId, metricKey) {
  const pair = pairwise.find((p) => p.run_a === baselineId && p.run_b === runId)
  return pair?.metrics?.[metricKey]
}

function MetricCard({ metricKey, runs, pairwise }) {
  const info = METRIC_INFO[metricKey]
  const baseline = runs[0]

  const chartData = runs.map((r) => {
    const mean = r.metrics[metricKey]?.mean ?? 0
    const isBaseline = r.run_id === baseline.run_id
    const pw = isBaseline ? null : findPairwiseVsBaseline(pairwise, baseline.run_id, r.run_id, metricKey)
    return {
      name: r.experiment_name,
      value: mean,
      isBaseline,
      direction: pw?.direction,
      significant: pw?.significant,
      pValue: pw?.p_value,
      confidenceInterval: pw?.confidence_interval,
      effectSize: pw?.effect_size,
      interpretation: pw?.interpretation,
      qValue: pw?.q_value,
      significantCorrected: pw?.significant_corrected,
      n: pw?.n,
      underpowered: pw?.underpowered,
      deltaPct:
        pw && baseline.metrics[metricKey]?.mean
          ? (pw.delta / Math.abs(baseline.metrics[metricKey].mean)) * 100
          : null,
    }
  })

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload
      return (
        <div className="bg-bg-card border border-border rounded-lg px-3 py-2 shadow-lg">
          <p className="text-text-primary text-sm font-medium">{d.name}</p>
          <p className="text-text-secondary text-xs">{info.format(d.value)}</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-sm font-semibold text-text-primary">
          {info.label} {info.lowerBetter ? '(lower is better)' : '(higher is better)'}
        </h3>
      </div>

      <div className="h-40 mb-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barCategoryGap="25%">
            <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip content={<CustomTooltip />} cursor={false} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={56}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={barColor(entry.isBaseline, entry.direction)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-col gap-1.5">
        {chartData.map((d) => (
          <div key={d.name} className="flex items-center justify-between text-xs">
            <span className="text-text-secondary truncate max-w-[40%]">{d.name}</span>
            <span className="font-mono text-text-primary">{info.format(d.value)}</span>
            {d.isBaseline ? (
              <span className="text-text-muted">baseline</span>
            ) : (
              <div className="text-right">
                <span
                  className={`font-medium ${
                  d.direction === 'improved'
                    ? 'text-success'
                    : d.direction === 'degraded'
                      ? 'text-danger'
                      : 'text-text-muted'
                }`}
                >
                  {d.significant ? 'significant' : '—'}{' '}
                  {d.deltaPct !== null ? `${d.deltaPct > 0 ? '+' : ''}${d.deltaPct.toFixed(0)}%` : ''}{' '}
                  {d.pValue != null ? `(p=${d.pValue.toFixed(3)})` : '(p=—)'}
                </span>
                {d.confidenceInterval && (
                  <p
                    className="text-[10px] text-text-muted mt-1"
                    title={`We’re 95% confident the true ${info.label.toLowerCase()} difference (candidate minus baseline) is between ${info.format(d.confidenceInterval[0])} and ${info.format(d.confidenceInterval[1])}.`}
                  >
                    95% CI: [{info.format(d.confidenceInterval[0])}, {info.format(d.confidenceInterval[1])}]
                  </p>
                )}
                {d.interpretation && d.interpretation !== 'negligible' && (
                  <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${d.interpretation === 'large' ? 'bg-purple-500/20 text-purple-300' : d.interpretation === 'medium' ? 'bg-accent-muted text-accent' : 'bg-bg-input text-text-muted'}`}>
                    {d.interpretation} effect{d.effectSize != null ? ` · d=${d.effectSize.toFixed(2)}` : ''}
                  </span>
                )}
                {d.qValue != null && (
                  <p
                    className="text-[10px] text-text-muted mt-1"
                    title="FDR-corrected across every metric x pair compared in this run, so testing more things at once doesn't inflate the false-positive rate."
                  >
                    {d.significantCorrected ? 'significant' : '—'} q={d.qValue.toFixed(3)} (FDR-corrected)
                  </p>
                )}
                {d.underpowered && (
                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-warning-muted text-warning">
                    underpowered · n={d.n}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function MetricsComparison({ runs, pairwise }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-text-primary mb-1">Metrics Comparison</h2>
      <p className="text-xs text-text-secondary mb-4">
        Each bar is a run's average for that metric vs. the leftmost run (the baseline). "significant" means the
        difference is statistically significant — unlikely to be random noise — not just numerically different.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Object.keys(METRIC_INFO).map((key) => (
          <MetricCard key={key} metricKey={key} runs={runs} pairwise={pairwise} />
        ))}
      </div>
    </div>
  )
}
