import { Fragment, useState } from 'react'
import EmptyState from './EmptyState'
import { TextButton } from './Button'

function truncate(text, n = 200) {
  if (!text) return ''
  return text.length > n ? `${text.slice(0, n)}…` : text
}

export default function CorporaTable({ corpora, onDelete }) {
  const [expandedId, setExpandedId] = useState(null)

  if (corpora.length === 0) {
    return (
      <EmptyState>
        No knowledge bases yet. Upload one on the left, then attach it to an experiment to enable
        retrieval-augmented (RAG) answers.
      </EmptyState>
    )
  }

  return (
    <div className="bg-bg-card border border-border rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-text-muted text-xs uppercase tracking-wider">
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Documents</th>
            <th className="px-4 py-3 font-medium">Created</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {corpora.map((corpus) => (
            <Fragment key={corpus.id}>
              <tr className="border-b border-border last:border-0 hover:bg-bg-card-hover transition-colors">
                <td className="px-4 py-3 text-text-primary font-medium">
                  {corpus.name}
                  {corpus.description && (
                    <p className="text-text-muted text-xs font-normal mt-0.5">{corpus.description}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-text-secondary">{corpus.documents.length}</td>
                <td className="px-4 py-3 text-text-muted text-xs whitespace-nowrap">
                  {new Date(corpus.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <TextButton onClick={() => setExpandedId(expandedId === corpus.id ? null : corpus.id)}>
                      {expandedId === corpus.id ? 'Hide' : 'View'}
                    </TextButton>
                    <TextButton danger onClick={() => onDelete(corpus.id)}>
                      Delete
                    </TextButton>
                  </div>
                </td>
              </tr>
              {expandedId === corpus.id && (
                <tr className="border-b border-border last:border-0">
                  <td colSpan={4} className="px-4 py-4 bg-bg-input">
                    <p className="text-xs uppercase tracking-wider text-text-muted mb-2">Documents</p>
                    <div className="flex flex-col gap-2">
                      {corpus.documents.map((doc) => (
                        <div key={doc.id} className="border border-border rounded-lg p-3 bg-bg-card">
                          <p className="text-text-primary text-xs font-medium mb-1">{doc.filename}</p>
                          <p className="text-text-muted text-xs">{truncate(doc.content)}</p>
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
