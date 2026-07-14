import { useMemo, useState } from 'react'

export default function QuestionExplorer({ runs, resultsByRun }) {
  const baselineResults = resultsByRun[runs[0]?.run_id] || []
  const questions = useMemo(() => baselineResults.map((r) => r.question), [baselineResults])
  const [selected, setSelected] = useState(questions[0] || '')

  if (questions.length === 0) return null

  return (
    <div>
      <h2 className="text-lg font-semibold text-text-primary mb-4">Question Explorer</h2>

      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="w-full bg-bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors cursor-pointer mb-4"
      >
        {questions.map((q, i) => (
          <option key={i} value={q}>
            {i + 1}. {q}
          </option>
        ))}
      </select>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {runs.map((r) => {
          const result = (resultsByRun[r.run_id] || []).find((res) => res.question === selected)
          return (
            <div key={r.run_id} className="bg-bg-card border border-border rounded-2xl p-5 flex flex-col">
              <h3 className="text-sm font-semibold text-text-primary mb-3">{r.experiment_name}</h3>
              {result ? (
                <>
                  <div className="bg-bg-input border border-border rounded-lg p-3 text-xs text-text-secondary leading-relaxed max-h-48 overflow-y-auto mb-4 flex-1">
                    {result.response}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <p className="text-text-muted">
                      Lat: <span className="text-text-primary font-mono">{Math.round(result.latency_ms)}ms</span>
                    </p>
                    <p className="text-text-muted">
                      Cost:{' '}
                      <span className="text-text-primary font-mono">${result.cost_usd.toFixed(6)}</span>
                    </p>
                    <p className="text-text-muted">
                      Rel: <span className="text-text-primary font-mono">{result.relevancy_score.toFixed(4)}</span>
                    </p>
                    <p className="text-text-muted">
                      Hall:{' '}
                      <span className="text-text-primary font-mono">
                        {result.hallucination_score.toFixed(4)}
                      </span>
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-text-muted text-xs">No result for this question in this run.</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
