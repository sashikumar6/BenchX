import { useEffect, useRef } from 'react'
import { runProgressUrl } from '../api'

// Reconnects with a capped backoff. The REST run endpoint remains the source
// of truth after reconnecting, while this hook supplies immediate live events.
export function useRunProgress(runId, enabled, onEvent) {
  const callbackRef = useRef(onEvent)

  useEffect(() => {
    callbackRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    if (!runId || !enabled) return undefined

    let socket
    let reconnectTimer
    let stopped = false
    let attempts = 0

    const connect = () => {
      if (stopped) return
      socket = new WebSocket(runProgressUrl(runId))
      socket.onopen = () => {
        attempts = 0
      }
      socket.onmessage = (message) => {
        try {
          callbackRef.current(JSON.parse(message.data))
        } catch {
          // Ignore malformed events; the completed refresh will reconcile state.
        }
      }
      socket.onclose = () => {
        if (stopped) return
        const delay = Math.min(3000, 400 * 2 ** attempts)
        attempts += 1
        reconnectTimer = setTimeout(connect, delay)
      }
      socket.onerror = () => socket.close()
    }

    connect()
    return () => {
      stopped = true
      clearTimeout(reconnectTimer)
      socket?.close()
    }
  }, [runId, enabled])
}
