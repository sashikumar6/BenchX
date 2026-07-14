// Minimal RFC-4180-ish CSV parser: handles quoted fields, embedded commas,
// and escaped double-quotes ("").
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && next === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

export function parseDatasetFile(filename, text) {
  const lower = filename.toLowerCase()

  if (lower.endsWith('.json')) {
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) {
      throw new Error('JSON dataset must be an array of {question, ground_truth} objects')
    }
    return parsed.map((item) => ({
      question: item.question,
      ground_truth: item.ground_truth ?? null,
    }))
  }

  if (lower.endsWith('.csv')) {
    const rows = parseCsv(text)
    if (rows.length === 0) return []
    const [header, ...dataRows] = rows
    const qIdx = header.findIndex((h) => h.trim().toLowerCase() === 'question')
    const gtIdx = header.findIndex((h) => h.trim().toLowerCase() === 'ground_truth')
    if (qIdx === -1) throw new Error('CSV must have a "question" column')

    return dataRows.map((r) => ({
      question: r[qIdx]?.trim() ?? '',
      ground_truth: gtIdx >= 0 ? r[gtIdx]?.trim() || null : null,
    }))
  }

  throw new Error('Unsupported file type — upload a .csv or .json file')
}
