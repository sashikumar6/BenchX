import { METRIC_INFO } from '../constants'
import { meanStd } from '../utils/stats'
import { band } from './ScoreBar'

const FIELD_MAP = {
  latency: 'latency_ms',
  cost: 'cost_usd',
  relevancy: 'relevancy_score',
  hallucination: 'hallucination_score',
}

// relevancy/hallucination are 0-1 scores — show as a percentage + bar, not a bare decimal.
const SCORE_KEYS = new Set(['relevancy', 'hallucination'])

export default function MetricSummaryCards({ results }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Object.entries(METRIC_INFO).map(([key, info]) => {
        const values = results.map((r) => r[FIELD_MAP[key]])
        const { mean, std } = meanStd(values)
        const isScore = SCORE_KEYS.has(key)
        return (
          <div key={key} className="bg-bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-text-primary">{info.label}</h3>
            </div>
            <p className="text-2xl font-semibold text-text-primary font-mono">
              {results.length ? (isScore ? `${(mean * 100).toFixed(0)}%` : info.format(mean)) : '—'}
            </p>
            <p className="text-xs text-text-muted mt-1">
              {results.length ? `± ${info.format(std)} std` : 'No results yet'}
            </p>
            {results.length > 0 && isScore && (
              <div className="mt-3 h-1.5 rounded-full bg-bg-input overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${band(mean, info.lowerBetter).bar}`}
                  style={{ width: `${Math.max(0, Math.min(1, mean)) * 100}%` }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
