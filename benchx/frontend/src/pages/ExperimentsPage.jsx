import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ExperimentConfigurator from '../components/ExperimentConfigurator'
import ExperimentsTable from '../components/ExperimentsTable'
import { createExperiment, createRun, deleteExperiment, listDatasets, listExperiments } from '../api'
import { useToast } from '../components/Toast'

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState([])
  const [datasets, setDatasets] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [starting, setStarting] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()

  const refresh = useCallback(async () => {
    try {
      const [exps, sets] = await Promise.all([listExperiments(), listDatasets()])
      setExperiments(exps)
      setDatasets(sets)
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

  const handleStartRun = async (experimentId, datasetId) => {
    setStarting(true)
    try {
      const run = await createRun({ experiment_id: experimentId, dataset_id: datasetId })
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

  if (loading) {
    return <div className="text-text-secondary text-sm">Loading experiments…</div>
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
      <div className="lg:col-span-3">
        <ExperimentConfigurator onCreate={handleCreate} loading={creating} />
      </div>
      <div className="lg:col-span-7">
        <ExperimentsTable
          experiments={experiments}
          datasets={datasets}
          onDelete={handleDelete}
          onStartRun={handleStartRun}
          starting={starting}
        />
      </div>
    </div>
  )
}
