export default function ExportButton({ data }) {
  const handleExport = () => {
    if (!data) return

    const jsonString = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = `benchx-report-${new Date().toISOString().slice(0,10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex justify-center pt-8 pb-12">
      <button
        onClick={handleExport}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-bg-card hover:bg-bg-card-hover text-text-primary text-sm font-medium transition-all shadow-sm hover:shadow-md cursor-pointer"
      >
        <svg
          className="w-4 h-4 text-text-secondary"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        Export Full Report (JSON)
      </button>
    </div>
  )
}
