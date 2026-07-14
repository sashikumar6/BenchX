import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import MetricSummaryCards from '../components/MetricSummaryCards'
import ResultsTable from '../components/ResultsTable'
import Spinner from '../components/Spinner'
import { getDataset, getExperiment, getRun } from '../api'
import { useToast } from '../components/Toast'
import { useInterval } from '../hooks/useInterval'

const STATUS_STYLES = {
  running: 'bg-accent-muted text-accent border-accent/30',
  completed: 'bg-success-muted text-success border-success/30',
  failed: 'bg-danger-muted text-danger border-danger/30',
}

export default function RunDetailPage() {
  const { runId } = useParams()
  const [run, setRun] = useState(null)
  const [experiment, setExperiment] = useState(null)
  const [dataset, setDataset] = useState(null)
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  const refresh = useCallback(async () => {
    try {
      const runData = await getRun(runId)
      setRun(runData)

      if (!experiment || experiment.id !== runData.experiment_id) {
        getExperiment(runData.experiment_id).then(setExperiment).catch(() => {})
      }
      if (!dataset || dataset.id !== runData.dataset_id) {
        getDataset(runData.dataset_id).then(setDataset).catch(() => {})
      }
    } catch (err) {
      toast.error(`Failed to load run: ${err.message}`)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, toast])

  useEffect(() => {
    refresh()
  }, [refresh])

  useInterval(refresh, 2000, run?.status === 'running')

  if (loading || !run) {
    return <div className="text-text-secondary text-sm">Loading run…</div>
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/runs" className="text-xs text-text-secondary hover:text-text-primary transition-colors">
          ← Back to Runs
        </Link>
      </div>

      <div className="bg-bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">
              {experiment?.name || 'Run detail'}
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              {experiment?.model} · temp {experiment?.temperature?.toFixed(1)} · max_tokens{' '}
              {experiment?.max_tokens} · dataset {dataset?.name || '—'}
            </p>
            {experiment?.system_prompt && (
              <p className="text-xs text-text-muted mt-1 max-w-2xl truncate">
                System prompt: {experiment.system_prompt}
              </p>
            )}
          </div>
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border ${STATUS_STYLES[run.status] || ''}`}
          >
            {run.status === 'running' && <Spinner className="w-3 h-3" />}
            {run.status} · {run.completed_questions}/{run.total_questions}
          </span>
        </div>
        {run.error && <p className="text-danger text-sm mt-3">{run.error}</p>}
      </div>

      <MetricSummaryCards results={run.results} />

      <ResultsTable results={run.results} />
    </div>
  )
}
