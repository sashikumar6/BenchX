import { useCallback, useEffect, useState } from 'react'
import RunsTable from '../components/RunsTable'
import { listDatasets, listExperiments, listRuns } from '../api'
import { useToast } from '../components/Toast'
import { useInterval } from '../hooks/useInterval'

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

  const hasActiveRuns = runs.some((r) => r.status === 'running')
  useInterval(refresh, 2000, hasActiveRuns)

  if (loading) {
    return <div className="text-text-secondary text-sm">Loading runs…</div>
  }

  return (
    <RunsTable runs={runs} experimentNames={experimentNames} datasetNames={datasetNames} />
  )
}
