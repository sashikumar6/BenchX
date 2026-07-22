import { useEffect, useMemo, useState } from 'react'
import { listCorpora, listModels } from '../api'
import Button from './Button'

const EMPTY_FORM = {
  name: '',
  type: 'builtin',
  model: '',
  endpoint_url: '',
  auth_header: '',
  temperature: 0.7,
  max_tokens: 1000,
  system_prompt: '',
  chunk_size: 256,
  top_k: 3,
  corpus_id: '',
}

const PROVIDER_LABELS = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  groq: 'Groq',
  nvidia: 'NVIDIA',
}

const CATEGORY_STYLES = {
  frontier: 'bg-accent-muted text-accent border-accent/30',
  efficient: 'bg-success-muted text-success border-success/30',
  reasoning: 'bg-warning-muted text-warning border-warning/30',
}

function formatContext(contextWindow) {
  return contextWindow >= 1000 ? `${Math.round(contextWindow / 1000)}K context` : `${contextWindow} context`
}

function formatCost(cost) {
  if (cost < 0.001) return cost.toFixed(6)
  if (cost < 1) return cost.toFixed(4)
  return cost.toFixed(2)
}

function ModelSelector({ groups, selectedModel, onChange, loading }) {
  const [open, setOpen] = useState(false)
  const selected = useMemo(
    () => Object.values(groups).flat().find((model) => model.key === selectedModel),
    [groups, selectedModel]
  )
  const providerEntries = Object.entries(groups).filter(([, models]) => models.length > 0)

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-text-secondary mb-1.5">Model</label>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={loading}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 bg-bg-input border border-border rounded-xl px-4 py-2.5 text-left transition-colors focus:outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
      >
        {selected ? (
          <span>
            <span className="block text-sm text-text-primary">{selected.display_name}</span>
            <span className="block text-xs text-text-muted mt-0.5">{formatContext(selected.context_window)} · ~${formatCost(selected.cost_per_1k)} / 1K tokens</span>
          </span>
        ) : (
          <span className="text-sm text-text-muted">{loading ? 'Loading supported models…' : 'Select a model'}</span>
        )}
        <span className="text-text-muted text-xs">▾</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-2 w-full max-h-96 overflow-y-auto rounded-xl border border-border bg-bg-card shadow-2xl">
          {providerEntries.map(([provider, models]) => (
            <div key={provider} className="border-b border-border last:border-0">
              <p className="px-4 py-2 text-[10px] uppercase tracking-wider font-semibold text-text-muted bg-bg-input">── {PROVIDER_LABELS[provider]} ──</p>
              {models.map((model) => (
                <button
                  key={model.key}
                  type="button"
                  onClick={() => { onChange(model.key); setOpen(false) }}
                  className={`w-full px-4 py-3 text-left hover:bg-bg-card-hover transition-colors cursor-pointer ${selectedModel === model.key ? 'bg-accent-muted' : ''}`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">{model.display_name}</span>
                    <span className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${CATEGORY_STYLES[model.category]}`}>{model.category}</span>
                  </span>
                  <span className="block text-xs text-text-muted mt-1">{formatContext(model.context_window)} · ~${formatCost(model.cost_per_1k)} / 1K tokens</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ExperimentConfigurator({ onCreate, loading }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [modelsByProvider, setModelsByProvider] = useState({})
  const [modelsLoading, setModelsLoading] = useState(true)
  const [modelsError, setModelsError] = useState('')
  const [corpora, setCorpora] = useState([])

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  useEffect(() => {
    let active = true
    listModels()
      .then((groups) => {
        if (!active) return
        setModelsByProvider(groups)
        const firstModel = Object.values(groups).flat()[0]?.key
        setForm((previous) => previous.model ? previous : { ...previous, model: firstModel || '' })
      })
      .catch((error) => active && setModelsError(`Failed to load models: ${error.message}`))
      .finally(() => active && setModelsLoading(false))
    listCorpora().then((data) => active && setCorpora(data)).catch(() => {})
    return () => { active = false }
  }, [])

  const handleTemperatureChange = (e) => {
    set('temperature', parseFloat(e.target.value))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return

    const ragEnabled = form.type === 'builtin' && form.corpus_id !== ''

    const payload = {
      name: form.name.trim(),
      type: form.type,
      model: form.type === 'external' ? 'external-agent' : form.model,
      endpoint_url: form.type === 'external' ? form.endpoint_url.trim() : null,
      auth_header: form.type === 'external' ? form.auth_header.trim() || null : null,
      temperature: form.temperature,
      max_tokens: Number(form.max_tokens) || 1000,
      system_prompt: form.system_prompt.trim() || null,
      chunk_size: ragEnabled ? Number(form.chunk_size) || 256 : null,
      top_k: ragEnabled ? Number(form.top_k) || 3 : null,
      corpus_id: ragEnabled ? form.corpus_id : null,
    }

    const ok = await onCreate(payload)
    if (ok) setForm(EMPTY_FORM)
  }

  return (
    <div id="new-experiment-form" className="bg-bg-card border border-border rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-text-primary mb-1">New Experiment</h2>
      <p className="text-sm text-text-secondary mb-5">
        Configure a model, prompt, and parameters to benchmark.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Name</label>
          <input
            type="text"
            id="new-experiment-name"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="GPT-4o-mini baseline"
            required
            className="w-full bg-bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Experiment Type</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['builtin', 'Built-in (OpenAI/Anthropic)'],
              ['external', 'External Agent'],
            ].map(([type, label]) => (
              <button
                key={type}
                type="button"
                onClick={() => set('type', type)}
                className={`px-3 py-2 rounded-lg border text-xs font-medium cursor-pointer ${form.type === type ? 'border-accent bg-accent-muted text-accent' : 'border-border text-text-secondary bg-bg-input'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {form.type === 'builtin' ? <>
        <ModelSelector groups={modelsByProvider} selectedModel={form.model} onChange={(model) => set('model', model)} loading={modelsLoading} />
        {modelsError && <p className="text-danger text-xs -mt-2">{modelsError}</p>}

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
          <div className="flex justify-between text-[11px] text-text-muted mt-1">
            <span>0 — focused, deterministic</span>
            <span>2 — more random, varied</span>
          </div>
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

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            Knowledge Base (RAG) <span className="text-text-muted">(optional)</span>
          </label>
          <select
            value={form.corpus_id}
            onChange={(e) => set('corpus_id', e.target.value)}
            className="w-full bg-bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors cursor-pointer"
          >
            <option value="">None — answer from the model's own knowledge</option>
            {corpora.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.documents.length} docs)
              </option>
            ))}
          </select>
          <p className="text-[11px] text-text-muted mt-1.5">
            When set, BenchX retrieves the most relevant passages from this knowledge base and hands them to the
            model as context before it answers — this is what "RAG" means here.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Chunk Size {form.corpus_id === '' && <span className="text-text-muted">(unused)</span>}
            </label>
            <input
              type="number"
              min="1"
              disabled={form.corpus_id === ''}
              value={form.chunk_size}
              onChange={(e) => set('chunk_size', e.target.value)}
              className="w-full bg-bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-[11px] text-text-muted mt-1.5">Words per passage the knowledge base is split into.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Top K {form.corpus_id === '' && <span className="text-text-muted">(unused)</span>}
            </label>
            <input
              type="number"
              min="1"
              disabled={form.corpus_id === ''}
              value={form.top_k}
              onChange={(e) => set('top_k', e.target.value)}
              className="w-full bg-bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-[11px] text-text-muted mt-1.5">How many passages to retrieve per question.</p>
          </div>
        </div>
        </> : <>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Endpoint URL</label>
            <input type="url" required value={form.endpoint_url} onChange={(e) => set('endpoint_url', e.target.value)} placeholder="http://localhost:8001/query" className="w-full bg-bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Auth Token <span className="text-text-muted">(optional Bearer token)</span></label>
            <input type="password" value={form.auth_header} onChange={(e) => set('auth_header', e.target.value)} placeholder="Optional Bearer token" className="w-full bg-bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Notes</label>
            <textarea value={form.system_prompt} onChange={(e) => set('system_prompt', e.target.value)} placeholder="Legal-RAG v1 — retrieval settings and scope" rows={4} className="w-full bg-bg-input border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors resize-y font-mono" />
          </div>
        </>}

        <Button
          type="submit"
          disabled={loading || !form.name.trim() || (form.type === 'builtin' && (!form.model || modelsLoading))}
          className="mt-2 w-full"
        >
          {loading ? 'Saving…' : 'Save Experiment'}
        </Button>
      </form>
    </div>
  )
}
