const API_URL = 'http://localhost:8000'

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail || detail
    } catch {
      // response wasn't JSON — fall back to statusText
    }
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
  }

  if (res.status === 204) return null
  return res.json()
}

// ── Experiments ──────────────────────────────────────────────────────
export const listExperiments = () => request('/experiments')
export const getExperiment = (id) => request(`/experiments/${id}`)
export const createExperiment = (data) =>
  request('/experiments', { method: 'POST', body: JSON.stringify(data) })
export const deleteExperiment = (id) => request(`/experiments/${id}`, { method: 'DELETE' })

// ── Datasets ─────────────────────────────────────────────────────────
export const listDatasets = () => request('/datasets')
export const getDataset = (id) => request(`/datasets/${id}`)
export const createDataset = (data) =>
  request('/datasets', { method: 'POST', body: JSON.stringify(data) })
export const deleteDataset = (id) => request(`/datasets/${id}`, { method: 'DELETE' })

// ── Runs ─────────────────────────────────────────────────────────────
export const listRuns = () => request('/runs')
export const getRun = (id) => request(`/runs/${id}`)
export const getRunStatus = (id) => request(`/runs/${id}/status`)
export const createRun = (data) =>
  request('/runs', { method: 'POST', body: JSON.stringify(data) })

// ── Comparisons ──────────────────────────────────────────────────────
export const listComparisons = () => request('/comparisons')
export const getComparison = (id) => request(`/comparisons/${id}`)
export const createComparison = (data) =>
  request('/comparisons', { method: 'POST', body: JSON.stringify(data) })

export { API_URL }
