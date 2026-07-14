import { useState } from 'react'
import Modal from './Modal'

export default function RunModal({ experiment, datasets, onClose, onStart, starting }) {
  const [datasetId, setDatasetId] = useState(datasets[0]?.id ?? '')

  const handleStart = () => {
    if (!datasetId) return
    onStart(experiment.id, datasetId)
  }

  return (
    <Modal title={`Run "${experiment.name}"`} onClose={onClose}>
      {datasets.length === 0 ? (
        <p className="text-sm text-text-secondary">
          No datasets available. Upload one from the Datasets view first.
        </p>
      ) : (
        <>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Dataset</label>
          <select
            value={datasetId}
            onChange={(e) => setDatasetId(e.target.value)}
            className="w-full bg-bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors cursor-pointer mb-5"
          >
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.questions.length} questions)
              </option>
            ))}
          </select>

          <button
            onClick={handleStart}
            disabled={starting}
            className={`w-full px-6 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              starting
                ? 'bg-bg-input text-text-muted border border-border cursor-not-allowed'
                : 'bg-accent hover:bg-accent-hover text-white shadow-lg shadow-accent/20'
            }`}
          >
            {starting ? 'Starting…' : 'Start Run'}
          </button>
        </>
      )}
    </Modal>
  )
}
