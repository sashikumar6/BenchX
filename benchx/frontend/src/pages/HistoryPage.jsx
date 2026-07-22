import { useEffect, useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getProjectHistory, getProjectTrend, listProjects } from '../api'
import { useToast } from '../hooks/useToast'
import { METRIC_INFO } from '../constants'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'

const LINES = [
  ['latency', '#f59e0b'],
  ['cost', '#22c55e'],
  ['relevancy', '#6366f1'],
  ['hallucination', '#ef4444'],
]

export default function HistoryPage() {
  const [projects, setProjects] = useState([])
  const [selected, setSelected] = useState('')
  const [history, setHistory] = useState([])
  const [trend, setTrend] = useState([])
  const toast = useToast()

  useEffect(() => {
    listProjects().then((names) => { setProjects(names); setSelected(names[0] || '') }).catch((err) => toast.error(`Failed to load projects: ${err.message}`))
  }, [toast])

  useEffect(() => {
    if (!selected) { setHistory([]); setTrend([]); return }
    Promise.all([getProjectHistory(selected), getProjectTrend(selected)])
      .then(([items, trendData]) => { setHistory(items); setTrend(trendData.points || []) })
      .catch((err) => toast.error(`Failed to load project history: ${err.message}`))
  }, [selected, toast])

  return (
    <div>
      <PageHeader
        eyebrow="06 — TRENDS"
        title="History"
        description="Every comparison you save to a Project lands here as one row, so you can see whether a metric keeps improving (or regressing) release over release."
      />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <aside className="bg-bg-card border border-border rounded-2xl p-4 lg:col-span-1">
          <h2 className="text-sm font-semibold text-text-primary mb-3">Projects</h2>
          {projects.length ? (
            projects.map((project) => (
              <button
                key={project}
                onClick={() => setSelected(project)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm cursor-pointer ${
                  selected === project ? 'bg-accent text-white' : 'text-text-secondary hover:bg-bg-card-hover'
                }`}
              >
                {project}
              </button>
            ))
          ) : (
            <p className="text-sm text-text-secondary">
              No projects yet — save a comparison to one from the Compare page to start tracking it here.
            </p>
          )}
        </aside>
        <section className="lg:col-span-4 space-y-6">
          {history.length ? (
            <>
              <div className="bg-bg-card border border-border rounded-2xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-text-muted text-xs uppercase tracking-wider">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Baseline</th>
                      <th className="px-4 py-3">Candidate</th>
                      <th className="px-4 py-3">Verdict</th>
                      {LINES.map(([key]) => (
                        <th key={key} className="px-4 py-3" title="Change from baseline to candidate (candidate minus baseline)">
                          {METRIC_INFO[key]?.label ?? key} Δ
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((entry) => (
                      <tr key={entry.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 text-text-muted text-xs">{new Date(entry.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-text-primary">{entry.baseline_name}</td>
                        <td className="px-4 py-3 text-text-primary">{entry.candidate_name}</td>
                        <td className="px-4 py-3 text-accent text-xs font-semibold">{entry.verdict}</td>
                        {LINES.map(([key]) => (
                          <td key={key} className="px-4 py-3 text-text-secondary font-mono text-xs">
                            {entry.metrics[key]?.delta?.toFixed(3) ?? '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-bg-card border border-border rounded-2xl p-5">
                <h2 className="text-lg font-semibold text-text-primary mb-4">Metric trends</h2>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend}>
                      <XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString()} tick={{ fill: '#9ca3af', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                      <Tooltip labelFormatter={(value) => new Date(value).toLocaleString()} />
                      {LINES.map(([key, color]) => (
                        <Line key={key} type="monotone" dataKey={key} name={`${METRIC_INFO[key]?.label ?? key} Δ`} stroke={color} strokeWidth={2} connectNulls />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          ) : (
            <EmptyState>
              {selected ? 'No saved comparisons for this project yet.' : 'Select a project on the left to see its history.'}
            </EmptyState>
          )}
        </section>
      </div>
    </div>
  )
}
