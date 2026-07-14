function truncate(text, n = 30) {
  if (!text) return 'None'
  return text.length > n ? `${text.slice(0, n)}…` : text
}

const ROWS = [
  { key: 'model', label: 'Model' },
  { key: 'temperature', label: 'Temperature', format: (v) => v.toFixed(1) },
  { key: 'system_prompt', label: 'System Prompt', format: truncate },
  { key: 'dataset_name', label: 'Dataset' },
]

export default function ParameterGrid({ runs }) {
  return (
    <div className="bg-bg-card border border-border rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-text-muted text-xs uppercase tracking-wider">
              <th className="px-4 py-3 font-medium">Parameter</th>
              {runs.map((r) => (
                <th key={r.run_id} className="px-4 py-3 font-medium text-text-primary normal-case">
                  {r.experiment_name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.key} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-text-muted font-medium">{row.label}</td>
                {runs.map((r) => (
                  <td key={r.run_id} className="px-4 py-3 text-text-secondary font-mono text-xs">
                    {row.format ? row.format(r[row.key]) : r[row.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
