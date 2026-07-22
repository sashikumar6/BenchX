import { useState } from 'react'
import Modal from './Modal'
import Button from './Button'

export default function RunModal({ experiment, datasets, onClose, onStart, starting }) {
  const [datasetId, setDatasetId] = useState(datasets[0]?.id ?? '')
  const [replicateCount, setReplicateCount] = useState(1)

  const selectedDataset = datasets.find((d) => d.id === datasetId)
  const totalCalls = (selectedDataset?.questions.length ?? 0) * replicateCount

  const handleStart = () => {
    if (!datasetId) return
    onStart(experiment.id, datasetId, replicateCount)
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

          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            Replicates <span className="text-text-muted">(repeat each question N times)</span>
          </label>
          <input
            type="number"
            min="1"
            max="20"
            value={replicateCount}
            onChange={(e) => setReplicateCount(Math.max(1, Number(e.target.value) || 1))}
            className="w-full bg-bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors mb-2"
          />
          <p className="text-xs text-text-muted mb-5">
            {replicateCount > 1
              ? `Averages ${replicateCount} samples per question to reduce noise from temperature — ${totalCalls} total LLM calls (${replicateCount}x cost/time).`
              : `${totalCalls} total LLM calls. Increase replicates if temperature is high and you need noise-robust significance.`}
          </p>

          <Button onClick={handleStart} disabled={starting} className="w-full">
            {starting ? 'Starting…' : 'Start Run'}
          </Button>
        </>
      )}
    </Modal>
  )
}
