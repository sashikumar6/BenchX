import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

const METRIC_INFO = {
  latency: {
    label: 'Latency',
    unit: 'ms',
    lowerBetter: true,
    icon: '⚡',
    format: (v) => `${v.toFixed(1)} ms`,
  },
  cost: {
    label: 'Cost',
    unit: 'USD',
    lowerBetter: true,
    icon: '💰',
    format: (v) => `$${v.toFixed(6)}`,
  },
  relevancy: {
    label: 'Relevancy',
    unit: '',
    lowerBetter: false,
    icon: '🎯',
    format: (v) => v.toFixed(4),
  },
  hallucination: {
    label: 'Hallucination',
    unit: '',
    lowerBetter: true,
    icon: '🔍',
    format: (v) => v.toFixed(4),
  },
}

const BASELINE_COLOR = '#8b5cf6'
const CANDIDATE_COLOR = '#06b6d4'

function MetricCard({ metricKey, data }) {
  const info = METRIC_INFO[metricKey] || {
    label: metricKey,
    unit: '',
    lowerBetter: false,
    icon: '📊',
    format: (v) => v.toFixed(4),
  }

  const delta = data.delta
  const improved = info.lowerBetter ? delta < 0 : delta > 0

  const chartData = [
    { name: 'Baseline', value: data.baseline, fill: BASELINE_COLOR },
    { name: 'Candidate', value: data.candidate, fill: CANDIDATE_COLOR },
  ]

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-bg-card border border-border rounded-lg px-3 py-2 shadow-lg">
          <p className="text-text-primary text-sm font-medium">
            {payload[0].payload.name}
          </p>
          <p className="text-text-secondary text-xs">
            {info.format(payload[0].value)}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-bg-card border border-border rounded-2xl p-5 hover:border-border-hover transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">{info.icon}</span>
          <h3 className="text-sm font-semibold text-text-primary">
            {info.label}
          </h3>
        </div>
        <div
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            data.significant
              ? 'bg-success-muted text-success'
              : 'bg-bg-input text-text-muted'
          }`}
        >
          {data.significant ? '✅' : '❌'} p={data.p_value.toFixed(3)}
        </div>
      </div>

      {/* Scores */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-0.5">
            Baseline
          </p>
          <p className="text-sm font-mono font-medium text-baseline">
            {info.format(data.baseline)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-0.5">
            Candidate
          </p>
          <p className="text-sm font-mono font-medium text-candidate">
            {info.format(data.candidate)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-0.5">
            Delta
          </p>
          <p
            className={`text-sm font-mono font-semibold ${
              improved ? 'text-success' : delta === 0 ? 'text-text-muted' : 'text-danger'
            }`}
          >
            {delta > 0 ? '+' : ''}
            {info.format(delta)}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-28">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
            barCategoryGap="30%"
          >
            <XAxis
              dataKey="name"
              tick={{ fill: '#999999', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip content={<CustomTooltip />} cursor={false} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default function MetricsDashboard({ summary }) {
  if (!summary) return null

  const metricKeys = Object.keys(summary)

  return (
    <section id="metrics-dashboard">
      <h2 className="text-lg font-semibold text-text-primary mb-4">
        Metrics Overview
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricKeys.map((key, i) => (
          <div
            key={key}
            className="animate-fade-in"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <MetricCard metricKey={key} data={summary[key]} />
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-baseline" />
          <span className="text-xs text-text-secondary">Baseline (v1)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-candidate" />
          <span className="text-xs text-text-secondary">Candidate (v2)</span>
        </div>
      </div>
    </section>
  )
}
