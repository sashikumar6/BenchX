import { Link } from 'react-router-dom'
import Spinner from './Spinner'

const STATUS_STYLES = {
  running: 'bg-accent-muted text-accent border-accent/30',
  completed: 'bg-success-muted text-success border-success/30',
  failed: 'bg-danger-muted text-danger border-danger/30',
}

function formatDuration(startedAt, completedAt) {
  if (!startedAt) return '—'
  const end = completedAt ? new Date(completedAt) : new Date()
  const seconds = Math.max(0, Math.round((end - new Date(startedAt)) / 1000))
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

export default function RunsTable({ runs, experimentNames, datasetNames }) {
  if (runs.length === 0) {
    return (
      <div className="bg-bg-card border border-border rounded-2xl p-10 text-center text-text-secondary text-sm">
        No runs yet. Start one from the Experiments view.
      </div>
    )
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
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLES[run.status] || ''}`}
                >
                  {run.status === 'running' && <Spinner className="w-3 h-3" />}
                  {run.status}
                </span>
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
                <Link
                  to={`/runs/${run.id}`}
                  className="text-accent hover:text-accent-hover text-xs font-medium cursor-pointer"
                >
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
