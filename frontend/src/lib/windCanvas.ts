import type { Map as MLMap } from 'maplibre-gl'

export interface WindPoint { lat: number; lon: number; speed: number; dir: number; gusts: number }
interface Ctx { map: MLMap; points: WindPoint[] }

const KMH_PX = 0.35

export function updateWindCanvas(canvas: HTMLCanvasElement, ctx: Ctx | null, active: boolean) {
  if (!active || !ctx) {
    // clear once
    const c = canvas.getContext('2d')
    c?.clearRect(0, 0, canvas.width, canvas.height)
    canvas.dataset.active = '0'
    return
  }
  if (canvas.dataset.active === '1') return
  canvas.dataset.active = '1'
  const { map, points } = ctx
  const parts: { x: number; y: number; age: number }[] = []
  const resize = () => {
    const r = canvas.getBoundingClientRect()
    if (canvas.width !== Math.floor(r.width) || canvas.height !== Math.floor(r.height)) {
      canvas.width = Math.floor(r.width)
      canvas.height = Math.floor(r.height)
    }
  }
  resize()
  const spawn = () => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, age: Math.random() * 80 })
  for (let i = 0; i < 800; i++) parts.push(spawn())

  const nearest = (x: number, y: number) => {
    const ll = map.unproject([x, y])
    let best = points[0]
    let bd = Infinity
    for (const p of points) {
      const d = (p.lat - ll.lat) ** 2 + ((p.lon - ll.lng) * Math.cos(ll.lat * Math.PI / 180)) ** 2
      if (d < bd) { bd = d; best = p }
    }
    return best
  }

  const draw = () => {
    if (canvas.dataset.active !== '1') return
    resize()
    const c = canvas.getContext('2d')!
    c.globalCompositeOperation = 'destination-out'
    c.fillStyle = 'rgba(0,0,0,0.10)'
    c.fillRect(0, 0, canvas.width, canvas.height)
    c.globalCompositeOperation = 'source-over'
    c.lineCap = 'round'
    for (const p of parts) {
      const w = nearest(p.x, p.y)
      const rad = (w.dir * Math.PI) / 180
      const sp = w.speed * KMH_PX
      const nx = p.x - Math.sin(rad) * sp
      const ny = p.y + Math.cos(rad) * sp
      const col = w.speed > 60 ? '#ff2d55' : w.speed > 40 ? '#ff7a1a' : w.speed > 25 ? '#ffd23f' : '#4aa3ff'
      c.strokeStyle = col + 'cc'
      c.lineWidth = 1.8
      c.beginPath()
      c.moveTo(p.x, p.y)
      c.lineTo(nx, ny)
      c.stroke()
      p.x = nx
      p.y = ny
      p.age++
      if (p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height || p.age > 120) {
        const ns = spawn()
        p.x = ns.x; p.y = ns.y; p.age = 0
      }
    }
    requestAnimationFrame(draw)
  }
  requestAnimationFrame(draw)
}
