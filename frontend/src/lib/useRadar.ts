import { useEffect, useState } from 'react'

export interface RadarFrame { time: number; path: string }

export function useRadar() {
  const [frames, setFrames] = useState<RadarFrame[]>([])
  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('https://api.rainviewer.com/public/weather-maps.json')
        const j = await r.json()
        const past = (j?.radar?.past || []).map((f: any) => ({ time: f.time, path: f.path }))
        setFrames(past)
      } catch {}
    }
    load()
    const iv = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(iv)
  }, [])
  return frames
}

export function radarTileUrl(frame: RadarFrame | null | undefined, size = 256, color = 2, smooth = 1, snow = 1) {
  if (!frame) return null
  return `https://tile.rainviewer.com${frame.path}/${size}/{z}/{x}/{y}/${color}/${smooth}_${snow}.png`
}
