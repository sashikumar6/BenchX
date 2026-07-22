import { useCallback, useEffect, useState } from 'react'
import RunsTable from '../components/RunsTable'
import PageHeader from '../components/PageHeader'
import { listDatasets, listExperiments, listRuns } from '../api'
import { useToast } from '../hooks/useToast'
import { useRunProgress } from '../hooks/useRunProgress'

function RunProgressListener({ runId, onEvent }) {
  useRunProgress(runId, true, onEvent)
  return null
}

export default function RunsPage() {
  const [runs, setRuns] = useState([])
  const [experimentNames, setExperimentNames] = useState({})
  const [datasetNames, setDatasetNames] = useState({})
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  const refresh = useCallback(async () => {
    try {
      const [runsData, experiments, datasets] = await Promise.all([
        listRuns(),
        listExperiments(),
        listDatasets(),
      ])
      setRuns(runsData)
      setExperimentNames(Object.fromEntries(experiments.map((e) => [e.id, e.name])))
      setDatasetNames(Object.fromEntries(datasets.map((d) => [d.id, d.name])))
    } catch (err) {
      toast.error(`Failed to load runs: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleProgress = (event) => {
    setRuns((previous) => previous.map((run) => {
      if (run.id !== event.run_id) return run
      if (event.type === 'progress') return { ...run, completed_questions: event.completed, total_questions: event.total }
      if (event.type === 'completed') return { ...run, status: 'completed', completed_questions: run.total_questions }
      if (event.type === 'error') return { ...run, status: 'failed', error: event.message }
      return run
    }))
  }

  return (
    <div>
      <PageHeader
        eyebrow="04 — EXECUTION"
        title="Runs"
        description="A run executes one saved experiment against one dataset — every question gets sent to the model and scored. Start a run from the Run button on an experiment; progress and results land here."
      />
      {loading ? (
        <div className="bg-bg-card border border-border rounded-2xl p-4 space-y-3">{[1, 2, 3].map((row) => <div key={row} className="h-14 rounded-xl shimmer-loading" />)}</div>
      ) : (
        <>
          {runs.filter((run) => run.status === 'running').map((run) => <RunProgressListener key={run.id} runId={run.id} onEvent={handleProgress} />)}
          <RunsTable runs={runs} experimentNames={experimentNames} datasetNames={datasetNames} />
        </>
      )}
    </div>
  )
}
