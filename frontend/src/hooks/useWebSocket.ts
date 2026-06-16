import { useEffect, useRef, useCallback } from 'react'
import type { WSProgressMessage } from '../types'
import { useClipStore } from '../stores'

export function useWebSocket(jobId: string | null) {
  const wsRef = useRef<WebSocket | null>(null)
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { setProgress, setResult, setError } = useClipStore()

  const connect = useCallback(() => {
    if (!jobId) return
    const apiBase = import.meta.env.VITE_API_BASE_URL || ''
    const wsBase = import.meta.env.VITE_WS_URL || (apiBase ? apiBase.replace('https://', 'wss://') : `ws://${window.location.hostname}:2121`)
    const ws = new WebSocket(`${wsBase}/ws/${jobId}`)
    wsRef.current = ws

    ws.onopen = () => {
      retryCountRef.current = 0
    }

    ws.onmessage = (event) => {
      try {
        const msg: WSProgressMessage = JSON.parse(event.data)

        if (msg.type === 'complete') {
          setResult(msg.payload.data as Parameters<typeof setResult>[0])
        } else if (msg.type === 'error') {
          const errorData = msg.payload.data as { message: string } | undefined
          setError(errorData?.message || msg.payload.message)
        } else {
          setProgress(
            msg.payload.stage as Parameters<typeof setProgress>[0],
            msg.payload.percent,
            msg.payload.message
          )
        }
      } catch {
        // silent parse error
      }
    }

    ws.onerror = () => { /* silent */ }

    ws.onclose = (e) => {
      if (e.code === 1000) return // Normal close
      if (retryCountRef.current < 5) {
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000)
        retryCountRef.current++
        // silent reconnect
        retryTimerRef.current = setTimeout(connect, delay)
      } else {
        setError('Lost connection to server. Please refresh and try again.')
      }
    }
  }, [jobId, setProgress, setResult, setError])

  useEffect(() => {
    if (jobId) connect()
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      wsRef.current?.close(1000)
    }
  }, [jobId, connect])

  return wsRef
}
