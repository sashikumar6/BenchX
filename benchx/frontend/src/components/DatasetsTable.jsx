import { Fragment, useState } from 'react'
import EmptyState from './EmptyState'
import { TextButton } from './Button'

export default function DatasetsTable({ datasets, onDelete }) {
  const [expandedId, setExpandedId] = useState(null)

  if (datasets.length === 0) {
    return <EmptyState>No datasets yet — upload a CSV or JSON file on the left to get started.</EmptyState>
  }

  return (
    <div className="bg-bg-card border border-border rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-text-muted text-xs uppercase tracking-wider">
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Questions</th>
            <th className="px-4 py-3 font-medium">Created</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {datasets.map((ds) => (
            <Fragment key={ds.id}>
              <tr className="border-b border-border last:border-0 hover:bg-bg-card-hover transition-colors">
                <td className="px-4 py-3 text-text-primary font-medium">{ds.name}</td>
                <td className="px-4 py-3 text-text-secondary">{ds.questions.length}</td>
                <td className="px-4 py-3 text-text-muted text-xs whitespace-nowrap">
                  {new Date(ds.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <TextButton onClick={() => setExpandedId(expandedId === ds.id ? null : ds.id)}>
                      {expandedId === ds.id ? 'Hide' : 'View'}
                    </TextButton>
                    <TextButton danger onClick={() => onDelete(ds.id)}>
                      Delete
                    </TextButton>
                  </div>
                </td>
              </tr>
              {expandedId === ds.id && (
                <tr className="border-b border-border last:border-0">
                  <td colSpan={4} className="px-4 py-4 bg-bg-input">
                    <p className="text-xs uppercase tracking-wider text-text-muted mb-2">
                      First {Math.min(5, ds.questions.length)} questions
                    </p>
                    <div className="flex flex-col gap-2">
                      {ds.questions.slice(0, 5).map((q, i) => (
                        <div key={i} className="border border-border rounded-lg p-3 bg-bg-card">
                          <p className="text-text-primary">{q.question}</p>
                          {q.ground_truth && (
                            <p className="text-text-muted text-xs mt-1">GT: {q.ground_truth}</p>
                          )}
                        </div>
                      ))}
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
