import { useState } from 'react'
import { METRIC_INFO } from '../constants'
import Button from './Button'

export default function ExportButton({ comparison, resultsByRun }) {
  const [copied, setCopied] = useState(false)

  const pair = comparison?.summary?.pairwise?.[0]
  const report = comparison && {
    benchx_version: '2.0',
    exported_at: new Date().toISOString(),
    comparison: {
      name: comparison.name,
      created_at: comparison.created_at,
      experiments: comparison.summary.runs,
      dataset: { name: comparison.summary.runs[0]?.dataset_name || 'Unknown' },
      summary: comparison.summary,
      verdict: pair?.verdict || 'INCONCLUSIVE',
      per_question: Object.entries(resultsByRun || {}).map(([run_id, results]) => ({ run_id, results })),
    },
  }

  const handleExport = () => {
    if (!report) return

    const jsonString = JSON.stringify(report, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = `benchx-report-${new Date().toISOString().slice(0,10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleCopy = async () => {
    if (!comparison || !pair) return
    const lines = Object.entries(pair.metrics || {}).map(([key, metric]) => {
      const info = METRIC_INFO[key]
      const sign = metric.delta > 0 ? '+' : ''
      return `${info.label}: ${sign}${info.format(metric.delta)} (p=${metric.p_value ?? '—'}, ${metric.interpretation} effect)`
    })
    const text = [
      `BenchX Comparison: ${comparison.name}`,
      `Verdict: ${pair.verdict} ${pair.verdict.includes('B') ? '✅' : ''}`,
      ...lines,
      `Evaluated on ${resultsByRun?.[comparison.run_ids[0]]?.length || 0} questions | Built with BenchX`,
    ].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="flex justify-center gap-3 pt-8 pb-12 flex-wrap">
      <Button variant="secondary" onClick={handleExport} className="flex items-center gap-2">
        <svg
          className="w-4 h-4 text-text-secondary"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        Export Report
      </Button>
      <Button variant="secondary" onClick={handleCopy}>
        {copied ? 'Copied!' : 'Copy Share Text'}
      </Button>
    </div>
  )
}
