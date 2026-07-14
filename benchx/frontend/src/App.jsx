import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import ExperimentsPage from './pages/ExperimentsPage'
import DatasetsPage from './pages/DatasetsPage'
import RunsPage from './pages/RunsPage'
import RunDetailPage from './pages/RunDetailPage'
import ComparePage from './pages/ComparePage'

const NAV_LINKS = [
  { to: '/experiments', label: 'Experiments' },
  { to: '/datasets', label: 'Datasets' },
  { to: '/runs', label: 'Runs' },
  { to: '/compare', label: 'Compare' },
]

export default function App() {
  return (
    <div className="min-h-screen bg-bg-primary">
      {/* ── Header / Nav ─────────────────────────────────────────── */}
      <header className="border-b border-border sticky top-0 z-40 bg-bg-primary/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <span className="text-white font-bold text-sm">BX</span>
            </div>
            <h1 className="text-xl font-semibold text-text-primary tracking-tight">BenchX</h1>
            <span className="text-xs text-text-muted bg-bg-card px-2 py-0.5 rounded-full border border-border">
              v0.2.0
            </span>
          </div>

          <nav className="flex items-center gap-1 bg-bg-card border border-border rounded-xl p-1">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-accent text-white'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-card-hover'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/* ── Main Content ─────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <Routes>
          <Route path="/" element={<Navigate to="/experiments" replace />} />
          <Route path="/experiments" element={<ExperimentsPage />} />
          <Route path="/datasets" element={<DatasetsPage />} />
          <Route path="/runs" element={<RunsPage />} />
          <Route path="/runs/:runId" element={<RunDetailPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="*" element={<Navigate to="/experiments" replace />} />
        </Routes>
      </main>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-border mt-16">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <p className="text-xs text-text-muted">BenchX — LLM experiment tracking and comparison</p>
          <p className="text-xs text-text-muted">Paired t-test · p &lt; 0.05</p>
        </div>
      </footer>
    </div>
  )
}
