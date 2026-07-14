import { useState } from 'react'
import AgentConfigPanel from './AgentConfigPanel'

const SAMPLE_QUESTIONS = [
  "What is compound interest?",
  "What is the difference between a Roth IRA and a Traditional IRA?",
  "How does dollar-cost averaging work?",
  "What is an emergency fund and how much should I save?",
  "What is the penalty for early withdrawal from a 401(k)?",
  "How do index funds differ from actively managed funds?",
  "What is a credit score and what factors affect it?",
  "What is tax-loss harvesting?",
  "What is the difference between term and whole life insurance?",
  "How does inflation affect purchasing power?",
]

const SAMPLE_GROUND_TRUTH = [
  "Compound interest is interest calculated on both the initial principal and the accumulated interest from previous periods.",
  "A Traditional IRA offers tax-deductible contributions with taxes paid on withdrawals. A Roth IRA uses after-tax contributions but offers tax-free withdrawals in retirement.",
  "Dollar-cost averaging is an investment strategy where you invest a fixed amount at regular intervals regardless of market conditions.",
  "An emergency fund is a savings reserve for unexpected expenses. Experts recommend saving three to six months of essential living expenses.",
  "Early withdrawals from a 401(k) before age 59½ typically incur a 10% early withdrawal penalty plus regular income taxes.",
  "Index funds passively track a market index with lower fees, while actively managed funds employ managers who try to outperform the market.",
  "A credit score is a numerical representation of creditworthiness (300-850) based on payment history, credit utilization, length of history, credit mix, and new inquiries.",
  "Tax-loss harvesting is selling securities at a loss to offset capital gains taxes. Up to $3,000 of excess losses can be deducted from ordinary income.",
  "Term life insurance covers a specific period with no cash value. Whole life provides lifelong coverage with a cash value component.",
  "Inflation erodes purchasing power — the same amount of money buys fewer goods and services over time.",
]

export default function RunComparison({ onRun, loading, progress }) {
  const [questionsText, setQuestionsText] = useState('')
  const [groundTruthText, setGroundTruthText] = useState('')
  const [showGroundTruth, setShowGroundTruth] = useState(false)

  // Configuration States
  const [baselineConfig, setBaselineConfig] = useState({
    model: 'gpt-4o-mini',
    temperature: 0.7,
    system_prompt: '',
  })

  const [candidateConfig, setCandidateConfig] = useState({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    system_prompt: 'You are a precise, factual financial advisor assistant. Answer questions accurately and concisely. Keep responses under 200 words.',
  })

  const parseLines = (text) =>
    text.split('\n').map(l => l.trim()).filter(Boolean)

  const handleRun = () => {
    const questions = parseLines(questionsText)
    if (questions.length === 0) return

    const groundTruth = showGroundTruth
      ? parseLines(groundTruthText)
      : []

    onRun(
      questions,
      groundTruth.length > 0 ? groundTruth : null,
      baselineConfig,
      candidateConfig
    )
  }

  const loadSample = () => {
    setQuestionsText(SAMPLE_QUESTIONS.join('\n'))
    setGroundTruthText(SAMPLE_GROUND_TRUTH.join('\n'))
    setShowGroundTruth(true)
  }

  const questionCount = parseLines(questionsText).length

  return (
    <section id="run-comparison" className="flex flex-col gap-6">
      
      {/* ── Configuration Panels ────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AgentConfigPanel
          title="Baseline Agent"
          subtitle="The control variant (e.g. your current production agent)"
          config={baselineConfig}
          onChange={setBaselineConfig}
          colorClass="bg-baseline/20 text-baseline"
          badgeText="v1"
        />
        <AgentConfigPanel
          title="Candidate Agent"
          subtitle="The experimental variant (e.g. improved prompt or model)"
          config={candidateConfig}
          onChange={setCandidateConfig}
          colorClass="bg-candidate/20 text-candidate"
          badgeText="v2"
        />
      </div>

      {/* ── Dataset Selection ───────────────────────────────────── */}
      <div className="bg-bg-card border border-border rounded-2xl p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              Evaluation Dataset
            </h2>
            <p className="text-sm text-text-secondary mt-0.5">
              Enter your test questions — one per line
            </p>
          </div>
          <button
            id="load-sample-btn"
            onClick={loadSample}
            className="text-xs text-accent hover:text-accent-hover transition-colors cursor-pointer px-3 py-1.5 rounded-lg border border-accent/30 hover:border-accent/60 bg-accent-muted"
          >
            Load Sample Dataset
          </button>
        </div>

        {/* Questions textarea */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            Questions{' '}
            {questionCount > 0 && (
              <span className="text-text-muted">({questionCount})</span>
            )}
          </label>
          <textarea
            value={questionsText}
            onChange={(e) => setQuestionsText(e.target.value)}
            placeholder={"What is compound interest?\nHow does dollar-cost averaging work?\nWhat is a credit score?"}
            rows={4}
            className="w-full bg-bg-input border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all resize-y font-mono"
          />
        </div>

        {/* Ground truth toggle + textarea */}
        <div className="mb-6">
          <button
            onClick={() => setShowGroundTruth(!showGroundTruth)}
            className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer mb-2"
          >
            <span
              className={`inline-block w-4 h-4 rounded border transition-all ${
                showGroundTruth
                  ? 'bg-accent border-accent'
                  : 'border-border'
              }`}
            >
              {showGroundTruth && (
                <svg viewBox="0 0 16 16" className="w-4 h-4 text-white" fill="currentColor">
                  <path d="M6.5 11.5L3 8l1-1 2.5 2.5L12 4l1 1z" />
                </svg>
              )}
            </span>
            Include ground truth answers (optional)
          </button>

          {showGroundTruth && (
            <div className="animate-slide-down">
              <textarea
                value={groundTruthText}
                onChange={(e) => setGroundTruthText(e.target.value)}
                placeholder={"Compound interest is interest calculated on both the initial principal...\nDollar-cost averaging is an investment strategy where you invest...\nA credit score is a numerical representation of creditworthiness..."}
                rows={3}
                className="w-full bg-bg-input border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all resize-y font-mono"
              />
              <p className="text-xs text-text-muted mt-1">
                One answer per line, matched by position to questions above
              </p>
            </div>
          )}
        </div>

        {/* Run button + progress */}
        <div className="flex items-center gap-4 pt-4 border-t border-border">
          <button
            onClick={handleRun}
            disabled={loading || questionCount === 0}
            className={`px-8 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              loading || questionCount === 0
                ? 'bg-bg-input text-text-muted border border-border cursor-not-allowed'
                : 'bg-accent hover:bg-accent-hover text-white shadow-lg shadow-accent/20 hover:shadow-accent/30'
            }`}
          >
            {loading ? 'Running Experiment…' : 'Run BenchX Comparison'}
          </button>

          {loading && (
            <div className="flex-1 flex items-center gap-3">
              <div className="flex-1 h-2 bg-bg-input rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-accent to-candidate rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <span className="text-xs text-text-secondary min-w-[3rem] text-right">
                {Math.round(progress)}%
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
