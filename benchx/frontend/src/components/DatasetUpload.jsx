import { useRef, useState } from 'react'
import { parseDatasetFile } from '../utils/parseDataset'

export default function DatasetUpload({ onUpload, loading }) {
  const [name, setName] = useState('')
  const [file, setFile] = useState(null)
  const [questionCount, setQuestionCount] = useState(null)
  const [parseError, setParseError] = useState(null)
  const fileInputRef = useRef(null)

  const handleFile = async (e) => {
    const f = e.target.files?.[0]
    setFile(null)
    setQuestionCount(null)
    setParseError(null)
    if (!f) return

    try {
      const text = await f.text()
      const questions = parseDatasetFile(f.name, text)
      setFile({ raw: f, questions })
      setQuestionCount(questions.length)
      if (!name) setName(f.name.replace(/\.(csv|json)$/i, ''))
    } catch (err) {
      setParseError(err.message)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !file) return
    const ok = await onUpload({ name: name.trim(), questions: file.questions })
    if (ok) {
      setName('')
      setFile(null)
      setQuestionCount(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="bg-bg-card border border-border rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-text-primary mb-1">Upload Dataset</h2>
      <p className="text-sm text-text-secondary mb-5">
        CSV needs <code className="text-accent">question,ground_truth</code> columns, or upload a
        JSON array of <code className="text-accent">{'{question, ground_truth}'}</code> objects.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Dataset name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Finance Q&A"
            className="w-full bg-bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            Upload CSV or JSON
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json"
            onChange={handleFile}
            className="w-full text-sm text-text-secondary file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-accent-muted file:text-accent file:text-sm file:font-medium file:cursor-pointer cursor-pointer"
          />
          {parseError && <p className="text-danger text-xs mt-1.5">{parseError}</p>}
          {questionCount !== null && !parseError && (
            <p className="text-success text-xs mt-1.5">Parsed {questionCount} questions</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !name.trim() || !file}
          className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
            loading || !name.trim() || !file
              ? 'bg-bg-input text-text-muted border border-border cursor-not-allowed'
              : 'bg-accent hover:bg-accent-hover text-white shadow-lg shadow-accent/20'
          }`}
        >
          {loading ? 'Uploading…' : 'Upload Dataset'}
        </button>
      </form>
    </div>
  )
}
