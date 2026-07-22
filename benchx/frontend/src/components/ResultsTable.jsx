import { Fragment, useState } from 'react'
import EmptyState from './EmptyState'
import ScoreBar from './ScoreBar'
import { TextButton } from './Button'

function truncate(text, n = 60) {
  if (!text) return '—'
  return text.length > n ? `${text.slice(0, n)}…` : text
}

export default function ResultsTable({ results }) {
  const [expandedId, setExpandedId] = useState(null)

  if (results.length === 0) {
    return <EmptyState>No results yet.</EmptyState>
  }

  return (
    <div className="bg-bg-card border border-border rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-text-muted text-xs uppercase tracking-wider">
            <th className="px-4 py-3 font-medium">Question</th>
            <th className="px-4 py-3 font-medium">Response</th>
            <th className="px-4 py-3 font-medium">Latency</th>
            <th className="px-4 py-3 font-medium">Cost</th>
            <th className="px-4 py-3 font-medium" title="How well the response addresses the question — higher is better.">Relevancy</th>
            <th className="px-4 py-3 font-medium" title="Risk that the response contains claims not supported by the context/ground truth — lower is better.">Hallucination</th>
            <th className="px-4 py-3 font-medium" />
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <Fragment key={r.id}>
              <tr className="border-b border-border last:border-0 hover:bg-bg-card-hover transition-colors">
                <td className="px-4 py-3 text-text-primary max-w-[16rem] truncate">{truncate(r.question, 50)}</td>
                <td className="px-4 py-3 text-text-secondary max-w-[16rem] truncate">{truncate(r.response, 50)}</td>
                <td className="px-4 py-3 text-text-secondary font-mono text-xs">{Math.round(r.latency_ms)} ms</td>
                <td className="px-4 py-3 text-text-secondary font-mono text-xs">${r.cost_usd.toFixed(6)}</td>
                <td className="px-4 py-3"><ScoreBar label="" value={r.relevancy_score} /></td>
                <td className="px-4 py-3"><ScoreBar label="" value={r.hallucination_score} lowerBetter /></td>
                <td className="px-4 py-3">
                  <TextButton onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                    {expandedId === r.id ? 'Collapse' : 'Expand'}
                  </TextButton>
                </td>
              </tr>
              {expandedId === r.id && (
                <tr className="border-b border-border last:border-0">
                  <td colSpan={7} className="px-4 py-4 bg-bg-input">
                    <div className="flex flex-col gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Question</p>
                        <p className="text-text-primary text-sm">{r.question}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Response</p>
                        <p className="text-text-secondary text-sm whitespace-pre-wrap">{r.response}</p>
                      </div>
                      {r.ground_truth && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Ground Truth</p>
                          <p className="text-text-secondary text-sm">{r.ground_truth}</p>
                        </div>
                      )}
                      {r.hallucination_reason && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">
                            Hallucination Reason
                          </p>
                          <p className="text-text-secondary text-sm">{r.hallucination_reason}</p>
                        </div>
                      )}
                      {r.retrieved_chunk_ids?.length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-accent mb-1.5">
                            Retrieved Context ({r.retrieved_chunk_ids.length} chunks)
                          </p>
                          <div className="flex flex-col gap-2">
                            {r.retrieved_chunk_ids.map((c) => (
                              <div key={c.chunk_id} className="border border-border rounded-lg p-3 bg-bg-card">
                                <p className="text-[10px] text-text-muted mb-1">{c.document_filename}</p>
                                <p className="text-text-secondary text-xs whitespace-pre-wrap">{c.content}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex gap-6">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Input Tokens</p>
                          <p className="text-text-primary text-sm font-mono">{r.tokens_input}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Output Tokens</p>
                          <p className="text-text-primary text-sm font-mono">{r.tokens_output}</p>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
