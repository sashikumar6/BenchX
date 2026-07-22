export function band(value, lowerBetter) {
  const good = lowerBetter ? value <= 0.2 : value >= 0.8
  const bad = lowerBetter ? value >= 0.5 : value <= 0.5
  if (good) return { bar: 'bg-success', text: 'text-success', glow: 'rgba(74,222,128,0.4)' }
  if (bad) return { bar: 'bg-danger', text: 'text-danger', glow: 'rgba(248,113,113,0.4)' }
  return { bar: 'bg-warning', text: 'text-warning', glow: 'rgba(251,191,36,0.4)' }
}

/** Compact 0-1 score as a labeled progress bar — mirrors how eval scores read at a glance. */
export default function ScoreBar({ label, value, lowerBetter = false, className = '' }) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  const { bar, text, glow } = band(value, lowerBetter)
  return (
    <div className={`min-w-[6.5rem] ${className}`}>
      <div className="flex items-center justify-between gap-2 font-mono text-[11px] mb-1">
        <span className="text-text-muted">{label}</span>
        <span className={`font-medium ${text}`}>{pct.toFixed(0)}%</span>
      </div>
      <div className="h-[5px] rounded-full bg-bg-input overflow-hidden">
        <div
          className={`h-full rounded-full ${bar} transition-all duration-500`}
          style={{ width: `${pct}%`, boxShadow: `0 0 8px ${glow}` }}
        />
      </div>
    </div>
  )
}
