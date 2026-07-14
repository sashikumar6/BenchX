// Mirrors backend/config.py SUPPORTED_MODELS keys.
export const SUPPORTED_MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (OpenAI)' },
  { value: 'gpt-4o', label: 'GPT-4o (OpenAI)' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (Anthropic)' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (Anthropic)' },
  { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant (Groq)' },
]

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
