import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import ExperimentsPage from './pages/ExperimentsPage'
import DatasetsPage from './pages/DatasetsPage'
import CorporaPage from './pages/CorporaPage'
import RunsPage from './pages/RunsPage'
import RunDetailPage from './pages/RunDetailPage'
import ComparePage from './pages/ComparePage'
import HistoryPage from './pages/HistoryPage'
import ErrorBoundary from './components/ErrorBoundary'
import Modal from './components/Modal'

const NAV_LINKS = [
  { to: '/experiments', label: 'Experiments' },
  { to: '/datasets', label: 'Datasets' },
  { to: '/corpora', label: 'Knowledge Base' },
  { to: '/runs', label: 'Runs' },
  { to: '/compare', label: 'Compare' },
  { to: '/history', label: 'History' },
]

function Breadcrumb() {
  const { pathname } = useLocation()
  const trail = pathname.replace(/^\//, '') || 'experiments'
  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="flex items-center gap-2 py-3 font-mono text-xs text-text-muted border-b border-border">
        <span>benchx.app</span>
        <span className="text-border-hover">/</span>
        <span className="text-accent">{trail}</span>
      </div>
    </div>
  )
}

export default function App() {
  const navigate = useNavigate()
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    const handleKeydown = (event) => {
      const target = event.target
      const editing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable
      if (event.key === '?' && !editing) { event.preventDefault(); setShowHelp(true); return }
      if (!event.metaKey && !event.ctrlKey) return
      if (event.key.toLowerCase() === 'n') { event.preventDefault(); navigate('/experiments'); setTimeout(() => document.getElementById('new-experiment-name')?.focus(), 0) }
      if (event.key.toLowerCase() === 'r') { event.preventDefault(); navigate('/runs') }
      if (event.key.toLowerCase() === 'k') { event.preventDefault(); navigate('/compare') }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [navigate])

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* ── Header / Nav ─────────────────────────────────────────── */}
      <header className="border-b border-border sticky top-0 z-40 bg-bg-primary/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-danger inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-warning inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-success inline-block" />
            </div>
            <h1 className="font-display font-bold text-xl text-text-primary tracking-tight">BenchX</h1>
            <span className="font-mono text-[11px] tracking-wide text-text-muted border border-border rounded-full px-2.5 py-1">
              v0.2.0
            </span>
          </div>

          <nav className="flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `pb-1 font-mono text-sm border-b-2 transition-colors ${
                    isActive
                      ? 'text-text-primary border-accent [text-shadow:0_0_12px_rgba(212,255,79,0.4)]'
                      : 'text-text-secondary border-transparent hover:text-text-primary'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <Breadcrumb />

      {/* ── Main Content ─────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-6 py-11">
        <Routes>
          <Route path="/" element={<Navigate to="/experiments" replace />} />
          <Route path="/experiments" element={<ErrorBoundary><ExperimentsPage /></ErrorBoundary>} />
          <Route path="/datasets" element={<ErrorBoundary><DatasetsPage /></ErrorBoundary>} />
          <Route path="/corpora" element={<ErrorBoundary><CorporaPage /></ErrorBoundary>} />
          <Route path="/runs" element={<ErrorBoundary><RunsPage /></ErrorBoundary>} />
          <Route path="/runs/:runId" element={<ErrorBoundary><RunDetailPage /></ErrorBoundary>} />
          <Route path="/compare" element={<ErrorBoundary><ComparePage /></ErrorBoundary>} />
          <Route path="/history" element={<ErrorBoundary><HistoryPage /></ErrorBoundary>} />
          <Route path="*" element={<Navigate to="/experiments" replace />} />
        </Routes>
      </main>

      {showHelp && <Modal title="Keyboard shortcuts" onClose={() => setShowHelp(false)}><div className="space-y-3 text-sm text-text-secondary"><p><kbd className="text-text-primary">⌘/Ctrl + N</kbd> Focus new experiment</p><p><kbd className="text-text-primary">⌘/Ctrl + R</kbd> Open runs</p><p><kbd className="text-text-primary">⌘/Ctrl + K</kbd> Open compare</p><p><kbd className="text-text-primary">?</kbd> Show this help</p></div></Modal>}

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-border mt-16">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between font-mono">
          <p className="text-xs text-text-muted">BenchX — LLM experiment tracking and comparison</p>
          <p className="text-xs text-text-muted">Paired t-test · p &lt; 0.05</p>
        </div>
      </footer>
    </div>
  )
}
