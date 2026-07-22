import { useCallback, useEffect, useState } from 'react'
import ComparisonSelector from '../components/ComparisonSelector'
import ParameterGrid from '../components/ParameterGrid'
import MetricsComparison from '../components/MetricsComparison'
import VerdictBanner from '../components/VerdictBanner'
import QuestionExplorer from '../components/QuestionExplorer'
import ExportButton from '../components/ExportButton'
import PageHeader from '../components/PageHeader'
import Button, { TextButton } from '../components/Button'
import { createComparison, getRun, listExperiments, listProjects, listRuns, saveComparisonToProject } from '../api'
import { useToast } from '../hooks/useToast'

function ComparisonSkeleton() {
  return <div className="space-y-6"><div className="h-16 rounded-2xl shimmer-loading" /><div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{[1, 2, 3, 4].map((card) => <div key={card} className="h-64 rounded-2xl shimmer-loading" />)}</div></div>
}

export default function ComparePage() {
  const [runs, setRuns] = useState([])
  const [experimentNames, setExperimentNames] = useState({})
  const [loading, setLoading] = useState(true)
  const [comparing, setComparing] = useState(false)
  const [comparison, setComparison] = useState(null)
  const [resultsByRun, setResultsByRun] = useState({})
  const [projects, setProjects] = useState([])
  const [projectName, setProjectName] = useState('')
  const [savingProject, setSavingProject] = useState(false)
  const toast = useToast()

  const refresh = useCallback(async () => {
    try {
      const [runsData, experiments] = await Promise.all([listRuns(), listExperiments()])
      setRuns(runsData.filter((r) => r.status === 'completed'))
      setExperimentNames(Object.fromEntries(experiments.map((e) => [e.id, e.name])))
      setProjects(await listProjects())
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

  const handleSaveProject = async () => {
    if (!projectName.trim() || !comparison) return
    setSavingProject(true)
    try {
      await saveComparisonToProject(projectName.trim(), comparison.id)
      setProjects((previous) => [...new Set([...previous, projectName.trim()])].sort())
      toast.success(`Saved to ${projectName.trim()}`)
    } catch (err) {
      toast.error(`Failed to save history: ${err.message}`)
    } finally {
      setSavingProject(false)
    }
  }

  if (loading) {
    return <ComparisonSkeleton />
  }

  if (comparing) return <ComparisonSkeleton />

  if (!comparison) {
    return (
      <div>
        <PageHeader
          eyebrow="05 — SIGNIFICANCE"
          title="Compare"
          description="Pick two or more completed runs and BenchX runs a paired significance test to tell you whether one is actually better — not just different by chance."
        />
        <ComparisonSelector
          runs={runs}
          experimentNames={experimentNames}
          onCompare={handleCompare}
          loading={comparing}
        />
      </div>
    )
  }

  const { runs: summaryRuns, pairwise } = comparison.summary

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary tracking-tight">{comparison.name}</h1>
          <p className="text-sm text-text-secondary mt-1">{summaryRuns.length} runs compared</p>
        </div>
        <TextButton onClick={() => setComparison(null)}>← New comparison</TextButton>
      </div>

      <ParameterGrid runs={summaryRuns} />
      <MetricsComparison runs={summaryRuns} pairwise={pairwise} />
      <VerdictBanner runs={summaryRuns} pairwise={pairwise} />
      <QuestionExplorer runs={summaryRuns} resultsByRun={resultsByRun} />
      <div className="bg-bg-card border border-border rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-text-primary">Save to a Project</h2>
        <p className="text-xs text-text-secondary mt-1 max-w-xl">
          A Project is just a named timeline of comparisons — save this one under a project (e.g. the feature
          you're iterating on) to track whether things keep improving across future comparisons on the History page.
        </p>
        <div className="flex gap-3 mt-4">
          <input list="project-names" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Legal-RAG" className="flex-1 bg-bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
          <datalist id="project-names">{projects.map((project) => <option key={project} value={project} />)}</datalist>
          <Button onClick={handleSaveProject} disabled={!projectName.trim() || savingProject} size="sm">
            {savingProject ? 'Saving…' : 'Save Comparison'}
          </Button>
        </div>
      </div>
      <ExportButton comparison={comparison} resultsByRun={resultsByRun} />
    </div>
  )
}
