import { useState } from 'react'
import RunModal from './RunModal'

const STATUS_STYLES = {
  configured: 'bg-bg-input text-text-muted border-border',
  running: 'bg-accent-muted text-accent border-accent/30',
  completed: 'bg-success-muted text-success border-success/30',
  failed: 'bg-danger-muted text-danger border-danger/30',
}

function truncate(text, n = 40) {
  if (!text) return '—'
  return text.length > n ? `${text.slice(0, n)}…` : text
}

export default function ExperimentsTable({ experiments, datasets, onDelete, onStartRun, starting }) {
  const [runTarget, setRunTarget] = useState(null)

  if (experiments.length === 0) {
    return (
      <div className="bg-bg-card border border-border rounded-2xl p-10 text-center text-text-secondary text-sm">
        No experiments yet. Configure one on the left to get started.
      </div>
    )
  }

  return (
    <div className="bg-bg-card border border-border rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-text-muted text-xs uppercase tracking-wider">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Model</th>
              <th className="px-4 py-3 font-medium">Temp</th>
              <th className="px-4 py-3 font-medium">Max Tokens</th>
              <th className="px-4 py-3 font-medium">System Prompt</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {experiments.map((exp) => (
              <tr key={exp.id} className="border-b border-border last:border-0 hover:bg-bg-card-hover transition-colors">
                <td className="px-4 py-3 text-text-primary font-medium">{exp.name}</td>
                <td className="px-4 py-3 text-text-secondary font-mono text-xs">{exp.model}</td>
                <td className="px-4 py-3 text-text-secondary">{exp.temperature.toFixed(1)}</td>
                <td className="px-4 py-3 text-text-secondary">{exp.max_tokens}</td>
                <td className="px-4 py-3 text-text-secondary max-w-[16rem] truncate" title={exp.system_prompt || ''}>
                  {truncate(exp.system_prompt)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLES[exp.status] || STATUS_STYLES.configured}`}
                  >
                    {exp.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-text-muted text-xs whitespace-nowrap">
                  {new Date(exp.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setRunTarget(exp)}
                      className="text-accent hover:text-accent-hover text-xs font-medium cursor-pointer"
                    >
                      Run
                    </button>
                    <button
                      onClick={() => onDelete(exp.id)}
                      className="text-danger hover:text-danger/80 text-xs font-medium cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {runTarget && (
        <RunModal
          experiment={runTarget}
          datasets={datasets}
          starting={starting}
          onClose={() => setRunTarget(null)}
          onStart={async (experimentId, datasetId) => {
            const ok = await onStartRun(experimentId, datasetId)
            if (ok) setRunTarget(null)
          }}
        />
      )}
    </div>
  )
}
