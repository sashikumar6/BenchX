import { useState } from 'react'
import Button from './Button'
import EmptyState from './EmptyState'

export default function ComparisonSelector({ runs, experimentNames, onCompare, loading }) {
  const [selected, setSelected] = useState([])
  const [name, setName] = useState('')

  const toggle = (runId) => {
    setSelected((prev) =>
      prev.includes(runId) ? prev.filter((id) => id !== runId) : [...prev, runId]
    )
  }

  const handleCompare = () => {
    if (selected.length < 2) return
    onCompare(selected, name.trim() || `Comparison ${new Date().toLocaleString()}`)
  }

  if (runs.length === 0) {
    return <EmptyState>No completed runs yet — finish a run first, then come back here to compare two or more.</EmptyState>
  }

  return (
    <div className="bg-bg-card border border-border rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-text-primary mb-1">Select runs to compare</h2>
      <p className="text-sm text-text-secondary mb-4">
        Pick two or more completed runs. The first one selected is treated as the baseline.
      </p>

      <div className="flex flex-col gap-2 max-h-80 overflow-y-auto mb-4">
        {runs.map((run) => {
          const checked = selected.includes(run.id)
          return (
            <label
              key={run.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
                checked ? 'border-accent bg-accent-muted' : 'border-border bg-bg-input hover:bg-bg-card-hover'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(run.id)}
                className="accent-accent cursor-pointer"
              />
              <div className="flex-1">
                <p className="text-sm text-text-primary font-medium">
                  {experimentNames[run.experiment_id] || run.experiment_id}
                </p>
                <p className="text-xs text-text-muted">
                  {new Date(run.started_at).toLocaleString()} · {run.total_questions} questions
                </p>
              </div>
              {checked && (
                <span className="text-[10px] uppercase tracking-wider text-accent font-semibold">
                  {selected[0] === run.id ? 'baseline' : `#${selected.indexOf(run.id) + 1}`}
                </span>
              )}
            </label>
          )
        })}
      </div>

      <div className="flex items-center gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Comparison name (optional)"
          className="flex-1 bg-bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
        />
        <Button onClick={handleCompare} disabled={selected.length < 2 || loading}>
          {loading ? 'Comparing…' : `Compare Selected Runs (${selected.length})`}
        </Button>
      </div>
    </div>
  )
}
