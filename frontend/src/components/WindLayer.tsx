import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useMap } from 'react-leaflet'

export interface WindPoint { lat: number; lon: number; speed: number; dir: number; gusts: number }

const KMH_PX = 0.35 // px per km/h per tick

export default function WindLayer({ points }: { points: WindPoint[] }) {
  const map = useMap()
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (!points.length) return
    const size = map.getSize()
    const canvas = L.DomUtil.create('canvas', 'wind-canvas leaflet-layer') as HTMLCanvasElement
    canvas.width = size.x
    canvas.height = size.y
    canvas.style.pointerEvents = 'none'
    canvas.style.zIndex = '450'
    map.getPanes().overlayPane.appendChild(canvas)
    const ctx = canvas.getContext('2d')!

    interface P { x: number; y: number; age: number }
    const parts: P[] = []
    const spawn = () => ({ x: Math.random() * size.x, y: Math.random() * size.y, age: Math.random() * 80 })
    for (let i = 0; i < 800; i++) parts.push(spawn())

    const nearest = (x: number, y: number) => {
      const ll = map.containerPointToLatLng([x, y])
      let best = points[0]
      let bd = Infinity
      for (const p of points) {
        const d = (p.lat - ll.lat) ** 2 + ((p.lon - ll.lng) * Math.cos(ll.lat * Math.PI / 180)) ** 2
        if (d < bd) { bd = d; best = p }
      }
      return best
    }

    const draw = () => {
      // keep canvas aligned with the map
      const tl = map.containerPointToLayerPoint([0, 0])
      L.DomUtil.setPosition(canvas, tl)
      const s = map.getSize()
      if (canvas.width !== s.x || canvas.height !== s.y) { canvas.width = s.x; canvas.height = s.y }
      ctx.clearRect(0, 0, s.x, s.y)
      ctx.lineCap = 'round'
      // fade previous frame instead of clearing -> wind streaks like Windy
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = 'rgba(0,0,0,0.10)'
      ctx.fillRect(0, 0, s.x, s.y)
      ctx.globalCompositeOperation = 'source-over'

      for (const p of parts) {
        const w = nearest(p.x, p.y)
        const rad = (w.dir * Math.PI) / 180
        const sp = w.speed * KMH_PX
        const dx = -Math.sin(rad) * sp
        const dy = Math.cos(rad) * sp // screen y grows southward
        const nx = p.x + dx
        const ny = p.y + dy
        const speedColor = w.speed > 60 ? '#ff2d55' : w.speed > 40 ? '#ff7a1a' : w.speed > 25 ? '#ffd23f' : '#4aa3ff'
        ctx.strokeStyle = speedColor + 'cc'
        ctx.lineWidth = 1.8
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(nx, ny)
        ctx.stroke()
        p.x = nx
        p.y = ny
        p.age++
        if (p.x < 0 || p.x > s.x || p.y < 0 || p.y > s.y || p.age > 120) {
          const ns = spawn()
          p.x = ns.x; p.y = ns.y; p.age = 0
        }
      }
      rafRef.current = requestAnimationFrame(draw)
    }

    const reset = () => { for (const p of parts) { const ns = spawn(); p.x = ns.x; p.y = ns.y; p.age = 0 } }
    const hide = () => { cancelAnimationFrame(rafRef.current); ctx.clearRect(0, 0, canvas.width, canvas.height) }
    const show = () => { reset(); cancelAnimationFrame(rafRef.current); rafRef.current = requestAnimationFrame(draw) }

    map.on('movestart zoomstart', hide)
    map.on('moveend zoomend', show)
    rafRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafRef.current)
      map.off('movestart zoomstart', hide)
      map.off('moveend zoomend', show)
      canvas.remove()
    }
  }, [points, map])

  return null
}
