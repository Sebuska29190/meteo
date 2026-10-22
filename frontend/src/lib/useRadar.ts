import { useEffect, useState } from 'react'

export function useRadarTimestamp() {
  const [ts, setTs] = useState<number | null>(null)
  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('https://api.rainviewer.com/public/weather-maps.json')
        const j = await r.json()
        const latest = j?.radar?.past?.[j.radar.past.length - 1]?.time
        if (latest) setTs(latest)
      } catch {}
    }
    load()
    const iv = setInterval(load, 10 * 60 * 1000)
    return () => clearInterval(iv)
  }, [])
  return ts
}