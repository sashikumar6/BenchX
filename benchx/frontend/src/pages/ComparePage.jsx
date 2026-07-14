import { useCallback, useEffect, useState } from 'react'
import ComparisonSelector from '../components/ComparisonSelector'
import ParameterGrid from '../components/ParameterGrid'
import MetricsComparison from '../components/MetricsComparison'
import VerdictBanner from '../components/VerdictBanner'
import QuestionExplorer from '../components/QuestionExplorer'
import ExportButton from '../components/ExportButton'
import { createComparison, getRun, listExperiments, listRuns } from '../api'
import { useToast } from '../components/Toast'

export default function ComparePage() {
  const [runs, setRuns] = useState([])
  const [experimentNames, setExperimentNames] = useState({})
  const [loading, setLoading] = useState(true)
  const [comparing, setComparing] = useState(false)
  const [comparison, setComparison] = useState(null)
  const [resultsByRun, setResultsByRun] = useState({})
  const toast = useToast()

  const refresh = useCallback(async () => {
    try {
      const [runsData, experiments] = await Promise.all([listRuns(), listExperiments()])
      setRuns(runsData.filter((r) => r.status === 'completed'))
      setExperimentNames(Object.fromEntries(experiments.map((e) => [e.id, e.name])))
    } catch (err) {
      toast.error(`Failed to load runs: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleCompare = async (runIds, name) => {
    setComparing(true)
    try {
      const [result, ...runDetails] = await Promise.all([
        createComparison({ run_ids: runIds, name }),
        ...runIds.map((id) => getRun(id)),
      ])
      setComparison(result)
      setResultsByRun(Object.fromEntries(runDetails.map((r) => [r.id, r.results])))
      toast.success('Comparison ready')
    } catch (err) {
      toast.error(`Failed to compare runs: ${err.message}`)
    } finally {
      setComparing(false)
    }
  }

  if (loading) {
    return <div className="text-text-secondary text-sm">Loading runs…</div>
  }

  if (!comparison) {
    return (
      <ComparisonSelector
        runs={runs}
        experimentNames={experimentNames}
        onCompare={handleCompare}
        loading={comparing}
      />
    )
  }

  const { runs: summaryRuns, pairwise } = comparison.summary

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">{comparison.name}</h1>
          <p className="text-sm text-text-secondary">{summaryRuns.length} runs compared</p>
        </div>
        <button
          onClick={() => setComparison(null)}
          className="text-sm text-accent hover:text-accent-hover cursor-pointer"
        >
          ← New comparison
        </button>
      </div>

      <ParameterGrid runs={summaryRuns} />
      <MetricsComparison runs={summaryRuns} pairwise={pairwise} />
      <VerdictBanner runs={summaryRuns} pairwise={pairwise} />
      <QuestionExplorer runs={summaryRuns} resultsByRun={resultsByRun} />
      <ExportButton data={comparison} />
    </div>
  )
}
