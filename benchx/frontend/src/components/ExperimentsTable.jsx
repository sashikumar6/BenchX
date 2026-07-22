import { useState } from 'react'
import RunModal from './RunModal'
import StatusPill from './StatusPill'
import EmptyState from './EmptyState'
import { TextButton } from './Button'

function truncate(text, n = 40) {
  if (!text) return '—'
  return text.length > n ? `${text.slice(0, n)}…` : text
}

export default function ExperimentsTable({ experiments, datasets, corporaById = {}, onDelete, onStartRun, starting }) {
  const [runTarget, setRunTarget] = useState(null)

  if (experiments.length === 0) {
    return <EmptyState>No experiments yet — create your first experiment on the left →</EmptyState>
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
              <th className="px-4 py-3 font-medium">Knowledge Base</th>
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
                <td className="px-4 py-3 text-text-secondary text-xs">
                  {exp.corpus_id ? (
                    <span
                      className="text-accent"
                      title={`Splits documents into ~${exp.chunk_size}-word passages and retrieves the top ${exp.top_k} most relevant per question.`}
                    >
                      {corporaById[exp.corpus_id]?.name || 'Knowledge base'} · {exp.chunk_size}-word chunks · top {exp.top_k}
                    </span>
                  ) : (
                    <span title="No knowledge base attached — answers come from the model's own knowledge.">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={exp.status} />
                </td>
                <td className="px-4 py-3 text-text-muted text-xs whitespace-nowrap">
                  {new Date(exp.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <TextButton onClick={() => setRunTarget(exp)} title="Run this experiment against a dataset">
                      Run
                    </TextButton>
                    <TextButton danger onClick={() => onDelete(exp.id)}>
                      Delete
                    </TextButton>
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
          onStart={async (experimentId, datasetId, replicateCount) => {
            const ok = await onStartRun(experimentId, datasetId, replicateCount)
            if (ok) setRunTarget(null)
          }}
        />
      )}
    </div>
  )
}
