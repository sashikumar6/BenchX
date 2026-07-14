import { useState } from 'react'
import { SUPPORTED_MODELS } from '../constants'

const EMPTY_FORM = {
  name: '',
  model: SUPPORTED_MODELS[0].value,
  temperature: 0.7,
  max_tokens: 1000,
  system_prompt: '',
  chunk_size: '',
  top_k: '',
}

export default function ExperimentConfigurator({ onCreate, loading }) {
  const [form, setForm] = useState(EMPTY_FORM)

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  const handleTemperatureChange = (e) => {
    set('temperature', parseFloat(e.target.value))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return

    const payload = {
      name: form.name.trim(),
      model: form.model,
      temperature: form.temperature,
      max_tokens: Number(form.max_tokens) || 1000,
      system_prompt: form.system_prompt.trim() || null,
      chunk_size: form.chunk_size === '' ? null : Number(form.chunk_size),
      top_k: form.top_k === '' ? null : Number(form.top_k),
    }

    const ok = await onCreate(payload)
    if (ok) setForm(EMPTY_FORM)
  }

  return (
    <div className="bg-bg-card border border-border rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-text-primary mb-1">New Experiment</h2>
      <p className="text-sm text-text-secondary mb-5">
        Configure a model, prompt, and parameters to benchmark.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="GPT-4o-mini baseline"
            required
            className="w-full bg-bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Model</label>
          <select
            value={form.model}
            onChange={(e) => set('model', e.target.value)}
            className="w-full bg-bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors cursor-pointer"
          >
            {SUPPORTED_MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-text-secondary">Temperature</label>
            <span className="text-xs font-mono text-accent bg-accent-muted px-2 py-0.5 rounded">
              {form.temperature.toFixed(1)}
            </span>
          </div>
          <input
            id="temperature"
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={form.temperature}
            onChange={handleTemperatureChange}
            onInput={handleTemperatureChange}
            className="w-full accent-accent cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Max Tokens</label>
          <input
            type="number"
            min="1"
            value={form.max_tokens}
            onChange={(e) => set('max_tokens', e.target.value)}
            className="w-full bg-bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            System Prompt <span className="text-text-muted">(optional)</span>
          </label>
          <textarea
            value={form.system_prompt}
            onChange={(e) => set('system_prompt', e.target.value)}
            placeholder="You are a precise financial advisor assistant..."
            rows={4}
            className="w-full bg-bg-input border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors resize-y font-mono"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Chunk Size <span className="text-text-muted">(optional)</span>
            </label>
            <input
              type="number"
              min="1"
              value={form.chunk_size}
              onChange={(e) => set('chunk_size', e.target.value)}
              className="w-full bg-bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Top K <span className="text-text-muted">(optional)</span>
            </label>
            <input
              type="number"
              min="1"
              value={form.top_k}
              onChange={(e) => set('top_k', e.target.value)}
              className="w-full bg-bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !form.name.trim()}
          className={`mt-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
            loading || !form.name.trim()
              ? 'bg-bg-input text-text-muted border border-border cursor-not-allowed'
              : 'bg-accent hover:bg-accent-hover text-white shadow-lg shadow-accent/20'
          }`}
        >
          {loading ? 'Saving…' : 'Save Experiment'}
        </button>
      </form>
    </div>
  )
}
