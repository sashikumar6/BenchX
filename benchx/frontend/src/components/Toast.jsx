import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

const ToastContext = createContext(null)

let nextId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    clearTimeout(timers.current[id])
    delete timers.current[id]
  }, [])

  const showToast = useCallback(
    (message, type = 'success') => {
      const id = nextId++
      setToasts((prev) => [...prev, { id, message, type }])
      timers.current[id] = setTimeout(() => dismiss(id), 4000)
      return id
    },
    [dismiss]
  )

  // Memoized so useToast() returns a stable reference across renders —
  // otherwise every render (e.g. each new toast) hands consumers a new
  // object, which retriggers any effect that lists it as a dependency
  // (see pages that do `useEffect(() => { refresh() }, [refresh])` where
  // `refresh` itself depends on `toast`), causing an infinite
  // fetch-fail -> toast -> rerender -> refetch loop.
  const toast = useMemo(
    () => ({
      success: (message) => showToast(message, 'success'),
      error: (message) => showToast(message, 'error'),
      info: (message) => showToast(message, 'info'),
    }),
    [showToast]
  )

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 w-80 max-w-[90vw]">
        {toasts.map((t) => (
          <div
            key={t.id}
            onClick={() => dismiss(t.id)}
            className={`animate-fade-in cursor-pointer rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur-xl ${
              t.type === 'success'
                ? 'bg-success-muted border-success/30 text-success'
                : t.type === 'error'
                  ? 'bg-danger-muted border-danger/30 text-danger'
                  : 'bg-accent-muted border-accent/30 text-accent'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
