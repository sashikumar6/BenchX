import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ExperimentConfigurator from '../components/ExperimentConfigurator'
import ExperimentsTable from '../components/ExperimentsTable'
import PageHeader from '../components/PageHeader'
import { createExperiment, createRun, deleteExperiment, listCorpora, listDatasets, listExperiments } from '../api'
import { useToast } from '../hooks/useToast'

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState([])
  const [datasets, setDatasets] = useState([])
  const [corporaById, setCorporaById] = useState({})
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [starting, setStarting] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()

  const refresh = useCallback(async () => {
    try {
      const [exps, sets, corpora] = await Promise.all([listExperiments(), listDatasets(), listCorpora()])
      setExperiments(exps)
      setDatasets(sets)
      setCorporaById(Object.fromEntries(corpora.map((c) => [c.id, c])))
    } catch (err) {
      toast.error(`Failed to load experiments: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleCreate = async (payload) => {
    setCreating(true)
    try {
      await createExperiment(payload)
      toast.success('Experiment saved')
      await refresh()
      return true
    } catch (err) {
      toast.error(`Failed to save experiment: ${err.message}`)
      return false
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteExperiment(id)
      toast.success('Experiment deleted')
      await refresh()
    } catch (err) {
      toast.error(`Failed to delete experiment: ${err.message}`)
    }
  }

  const handleStartRun = async (experimentId, datasetId, replicateCount = 1) => {
    setStarting(true)
    try {
      const run = await createRun({
        experiment_id: experimentId,
        dataset_id: datasetId,
        replicate_count: replicateCount,
      })
      toast.success('Run started')
      navigate(`/runs/${run.id}`)
      return true
    } catch (err) {
      toast.error(`Failed to start run: ${err.message}`)
      return false
    } finally {
      setStarting(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="01 — CONFIGURATION"
        title="Experiments"
        description="An experiment is a reusable configuration — model, prompt, and optional retrieval settings. Save one here, then run it against any dataset from the table on the right to produce results."
      />
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6"><div className="lg:col-span-3 h-[32rem] rounded-2xl shimmer-loading" /><div className="lg:col-span-7 bg-bg-card border border-border rounded-2xl p-4 space-y-3">{[1, 2, 3].map((row) => <div key={row} className="h-14 rounded-xl shimmer-loading" />)}</div></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
          <div className="lg:col-span-3">
            <ExperimentConfigurator onCreate={handleCreate} loading={creating} />
          </div>
          <div className="lg:col-span-7">
            <ExperimentsTable
              experiments={experiments}
              datasets={datasets}
              corporaById={corporaById}
              onDelete={handleDelete}
              onStartRun={handleStartRun}
              starting={starting}
            />
          </div>
        </div>
      )}
    </div>
  )
}
