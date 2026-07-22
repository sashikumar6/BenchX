import { useRef, useState } from 'react'

export default function CorpusUpload({ onUpload, loading }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState([])
  const fileInputRef = useRef(null)

  const handleFiles = async (e) => {
    const picked = Array.from(e.target.files || [])
    if (picked.length === 0) return
    const withContent = await Promise.all(
      picked.map(async (f) => ({ filename: f.name, content: await f.text() }))
    )
    setFiles(withContent)
    if (!name) setName(picked[0].name.replace(/\.(txt|md)$/i, ''))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || files.length === 0) return
    const ok = await onUpload({ name: name.trim(), description: description.trim() || null, documents: files })
    if (ok) {
      setName('')
      setDescription('')
      setFiles([])
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="bg-bg-card border border-border rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-text-primary mb-1">Upload Knowledge Base</h2>
      <p className="text-sm text-text-secondary mb-5">
        Upload one or more <code className="text-accent">.txt</code> or{' '}
        <code className="text-accent">.md</code> documents. They're chunked and embedded
        automatically the first time an experiment retrieves from them at a given chunk size.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Legal Docs"
            className="w-full bg-bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            Description <span className="text-text-muted">(optional)</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Contract templates and policy documents"
            className="w-full bg-bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Documents</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md"
            multiple
            onChange={handleFiles}
            className="w-full text-sm text-text-secondary file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-accent-muted file:text-accent file:text-sm file:font-medium file:cursor-pointer cursor-pointer"
          />
          {files.length > 0 && (
            <p className="text-success text-xs mt-1.5">
              {files.length} document{files.length > 1 ? 's' : ''} ready
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !name.trim() || files.length === 0}
          className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
            loading || !name.trim() || files.length === 0
              ? 'bg-bg-input text-text-muted border border-border cursor-not-allowed'
              : 'bg-accent hover:bg-accent-hover text-white shadow-lg shadow-accent/20'
          }`}
        >
          {loading ? 'Uploading…' : 'Upload Knowledge Base'}
        </button>
      </form>
    </div>
  )
}
