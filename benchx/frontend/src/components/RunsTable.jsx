import { Link } from 'react-router-dom'
import StatusPill from './StatusPill'
import EmptyState from './EmptyState'
import { textActionClasses } from './Button'

function formatDuration(startedAt, completedAt) {
  if (!startedAt) return '—'
  const end = completedAt ? new Date(completedAt) : new Date()
  const seconds = Math.max(0, Math.round((end - new Date(startedAt)) / 1000))
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

export default function RunsTable({ runs, experimentNames, datasetNames }) {
  if (runs.length === 0) {
    return <EmptyState>No runs yet — go to Experiments and hit Run to see results here.</EmptyState>
  }

  return (
    <div className="bg-bg-card border border-border rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-text-muted text-xs uppercase tracking-wider">
            <th className="px-4 py-3 font-medium">Experiment</th>
            <th className="px-4 py-3 font-medium">Dataset</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Progress</th>
            <th className="px-4 py-3 font-medium">Started</th>
            <th className="px-4 py-3 font-medium">Duration</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} className="border-b border-border last:border-0 hover:bg-bg-card-hover transition-colors">
              <td className="px-4 py-3 text-text-primary font-medium">
                {experimentNames[run.experiment_id] || run.experiment_id}
              </td>
              <td className="px-4 py-3 text-text-secondary">
                {datasetNames[run.dataset_id] || run.dataset_id}
              </td>
              <td className="px-4 py-3">
                <StatusPill status={run.status} />
              </td>
              <td className="px-4 py-3 text-text-secondary font-mono text-xs">
                {run.completed_questions}/{run.total_questions}
              </td>
              <td className="px-4 py-3 text-text-muted text-xs whitespace-nowrap">
                {run.started_at ? new Date(run.started_at).toLocaleString() : '—'}
              </td>
              <td className="px-4 py-3 text-text-secondary text-xs">
                {formatDuration(run.started_at, run.completed_at)}
              </td>
              <td className="px-4 py-3">
                <Link to={`/runs/${run.id}`} className={textActionClasses()}>
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
