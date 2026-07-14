import { METRIC_INFO } from '../constants'
import { meanStd } from '../utils/stats'

const FIELD_MAP = {
  latency: 'latency_ms',
  cost: 'cost_usd',
  relevancy: 'relevancy_score',
  hallucination: 'hallucination_score',
}

export default function MetricSummaryCards({ results }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Object.entries(METRIC_INFO).map(([key, info]) => {
        const values = results.map((r) => r[FIELD_MAP[key]])
        const { mean, std } = meanStd(values)
        return (
          <div key={key} className="bg-bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{info.icon}</span>
              <h3 className="text-sm font-semibold text-text-primary">{info.label}</h3>
            </div>
            <p className="text-2xl font-semibold text-text-primary font-mono">
              {results.length ? info.format(mean) : '—'}
            </p>
            <p className="text-xs text-text-muted mt-1">
              {results.length ? `± ${info.format(std)} std` : 'No results yet'}
            </p>
          </div>
        )
      })}
    </div>
  )
}
