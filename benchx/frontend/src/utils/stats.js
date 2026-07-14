export function meanStd(values) {
  if (values.length === 0) return { mean: 0, std: 0 }
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  if (values.length < 2) return { mean, std: 0 }
  const variance =
    values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (values.length - 1)
  return { mean, std: Math.sqrt(variance) }
}
