export const METRIC_INFO = {
  latency: { label: 'Latency', icon: '⚡', lowerBetter: true, format: (v) => `${Math.round(v)} ms` },
  cost: { label: 'Cost', icon: '💰', lowerBetter: true, format: (v) => `$${v.toFixed(6)}` },
  relevancy: { label: 'Relevancy', icon: '🎯', lowerBetter: false, format: (v) => v.toFixed(4) },
  hallucination: { label: 'Hallucination', icon: '🔍', lowerBetter: true, format: (v) => v.toFixed(4) },
}

export const VERDICT_STYLES = {
  BEST: { label: 'BEST', className: 'bg-success-muted text-success border-success/30' },
  WORST: { label: 'WORST', className: 'bg-danger-muted text-danger border-danger/30' },
  MIXED: { label: 'MIXED', className: 'bg-warning-muted text-warning border-warning/30' },
  BASELINE: { label: 'BASELINE', className: 'bg-accent-muted text-accent border-accent/30' },
  INCONCLUSIVE: { label: 'INCONCLUSIVE', className: 'bg-bg-input text-text-muted border-border' },
}
