import { useEffect, useRef } from 'react'

// Runs `callback` every `delayMs` while `active` is true.
export function useInterval(callback, delayMs, active = true) {
  const savedCallback = useRef(callback)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    if (!active || delayMs == null) return
    const id = setInterval(() => savedCallback.current(), delayMs)
    return () => clearInterval(id)
  }, [delayMs, active])
}
