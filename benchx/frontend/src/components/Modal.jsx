export default function Modal({ title, onClose, children, wide = false }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`animate-fade-in bg-bg-card border border-border rounded-2xl p-6 w-full ${
          wide ? 'max-w-2xl' : 'max-w-md'
        } max-h-[85vh] overflow-y-auto shadow-2xl`}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors cursor-pointer text-xl leading-none"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
