import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import MetricSummaryCards from '../components/MetricSummaryCards'
import ResultsTable from '../components/ResultsTable'
import StatusPill from '../components/StatusPill'
import ScoreBar from '../components/ScoreBar'
import { getDataset, getExperiment, getRun } from '../api'
import { useToast } from '../hooks/useToast'
import { useRunProgress } from '../hooks/useRunProgress'

export default function RunDetailPage() {
  const { runId } = useParams()
  const [run, setRun] = useState(null)
  const [experiment, setExperiment] = useState(null)
  const [dataset, setDataset] = useState(null)
  const [loading, setLoading] = useState(true)
  const [latestResult, setLatestResult] = useState(null)
  const toast = useToast()
  const hasWarnedRef = useRef(false)

  const refresh = useCallback(async () => {
    try {
      const runData = await getRun(runId)
      setRun(runData)

      if (!hasWarnedRef.current && runData.status !== 'running') {
        const failedCount = runData.results.filter((r) => r.response?.startsWith('[ERROR]')).length
        if (failedCount > 0) {
          hasWarnedRef.current = true
          toast.error(
            failedCount === runData.results.length
              ? `All ${failedCount} questions failed — expand a row below to see why.`
              : `${failedCount} of ${runData.results.length} questions failed — expand a row below to see why.`
          )
        }
      }

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

  const handleProgress = useCallback((event) => {
    if (event.type === 'progress') {
      setRun((previous) => previous ? {
        ...previous,
        completed_questions: event.completed,
        total_questions: event.total,
        results: event.latest_result && !previous.results.some((result) => result.id === event.latest_result.id)
          ? [...previous.results, event.latest_result]
          : previous.results,
      } : previous)
      if (event.latest_result) setLatestResult(event.latest_result)
    }
    if (event.type === 'completed') {
      setRun((previous) => previous ? { ...previous, status: 'completed', completed_questions: previous.total_questions } : previous)
      refresh()
    }
    if (event.type === 'error') {
      setRun((previous) => previous ? { ...previous, status: 'failed', error: event.message } : previous)
      hasWarnedRef.current = true
      toast.error(event.message)
      refresh()
    }
  }, [refresh, toast])

  useRunProgress(runId, run?.status === 'running', handleProgress)

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
            <h1 className="text-xl font-semibold text-text-primary tracking-tight">
              {experiment?.name || 'Run detail'}
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              {experiment?.model} · temperature {experiment?.temperature?.toFixed(1)} · max output{' '}
              {experiment?.max_tokens} tokens · dataset {dataset?.name || '—'}
            </p>
            {experiment?.system_prompt && (
              <p className="text-xs text-text-muted mt-1 max-w-2xl truncate">
                System prompt: {experiment.system_prompt}
              </p>
            )}
          </div>
          <StatusPill status={run.status} detail={`${run.completed_questions}/${run.total_questions} questions`} />
        </div>
        {run.error && <p className="text-danger text-sm mt-3">{run.error}</p>}
      </div>

      <MetricSummaryCards results={run.results} />

      {run.status === 'running' && (
        <div className="bg-bg-card border border-accent/30 rounded-2xl p-5">
          <div className="flex justify-between text-sm mb-2"><span className="text-text-primary font-medium">Live progress</span><span className="text-accent font-mono">{run.completed_questions} / {run.total_questions} questions completed</span></div>
          <div className="h-2 rounded-full bg-bg-input overflow-hidden"><div className="h-full bg-gradient-to-r from-accent to-candidate transition-all duration-500" style={{ width: `${run.total_questions ? (run.completed_questions / run.total_questions) * 100 : 0}%` }} /></div>
          {latestResult && (
            <div className="mt-4 rounded-xl bg-bg-input border border-border p-3">
              <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Latest result</p>
              <p className="text-sm text-text-primary truncate">{latestResult.question}</p>
              <p className="text-xs text-text-secondary mt-1 truncate">{latestResult.response}</p>
              <div className="flex items-center gap-4 mt-3">
                <p className="text-xs text-text-muted">{Math.round(latestResult.latency_ms)}ms · ${latestResult.cost_usd.toFixed(6)}</p>
                <ScoreBar label="Relevancy" value={latestResult.relevancy_score} className="flex-1 max-w-[10rem]" />
              </div>
            </div>
          )}
        </div>
      )}

      <ResultsTable results={run.results} />
    </div>
  )
}
