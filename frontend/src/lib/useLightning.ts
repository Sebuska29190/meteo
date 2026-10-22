import { useEffect, useRef, useState } from 'react'

export interface Strike { lat: number; lon: number; time: number; sig: number }

export function useLightning(enabled: boolean) {
  const [strikes, setStrikes] = useState<Strike[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  useEffect(() => {
    if (!enabled) return
    let closed = false
    let retry: number | null = null

    const connect = () => {
      if (closed) return
      try {
        const ws = new WebSocket('wss://ws1.blitzortung.org/')
        wsRef.current = ws
        ws.onopen = () => { try { ws.send(JSON.stringify({ a: 111 })) } catch {} }
        ws.onmessage = (ev) => {
          try {
            const d = JSON.parse(ev.data)
            if (d.lat != null && d.lon != null) {
              setStrikes((s) => [...s.slice(-500), { lat: d.lat, lon: d.lon, time: Date.now(), sig: d.sig ?? 0 }])
            }
          } catch {}
        }
        ws.onclose = () => { if (!closed && enabledRef.current) retry = window.setTimeout(connect, 5000) }
        ws.onerror = () => ws.close()
      } catch {}
    }
    connect()

    // prune strikes older than 30 min
    const iv = setInterval(() => setStrikes((s) => s.filter((x) => Date.now() - x.time < 30 * 60 * 1000)), 60 * 1000)

    return () => {
      closed = true
      if (retry) clearTimeout(retry)
      wsRef.current?.close()
      clearInterval(iv)
    }
  }, [enabled])

  return strikes
}
