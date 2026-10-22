import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, Marker, CircleMarker, Tooltip, useMap, useMapEvents } from "react-leaflet"
import L from 'leaflet'
import { Search, Play, Pause, X, Radar as RadarIcon, Plus, Minus, Crosshair, Bell, BellOff, Clock, Waves, Zap, Star, TrendingUp, Link as LinkIcon, Sun, Moon } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import { useI18n } from '../contexts/I18nContext'
import { useVigilance, type VigilanceLevel } from '../lib/useVigilance'
import { useRadar, radarTileUrl } from '../lib/useRadar'
import { useWeather } from '../lib/useWeather'
import { CITIES } from '../lib/cities'
import { fetchFloodStations, type FloodStation } from '../lib/floods'
import { useLightning } from '../lib/useLightning'
import WindLayer, { type WindPoint } from '../components/WindLayer'

const GEOJSON_URL = 'https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements.geojson'
const LEVEL_COLOR: Record<VigilanceLevel, string> = { 1: '#35d08c', 2: '#ffd23f', 3: '#ff7a1a', 4: '#ff2d55' }
const WMO: Record<number, string> = { 0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 51: '🌦️', 61: '🌧️', 71: '🌨️', 80: '🌦️', 95: '⛈️' }
const REFRESH_S = 120

function MapController({ center, zoom }: { center: [number, number] | null; zoom: number }) {
  const map = useMap()
  useEffect(() => { if (center) map.flyTo(center, zoom, { duration: 1.2 }) }, [center?.[0], center?.[1], zoom])
  return null
}
function Zoomer({ delta }: { delta: number }) {
  const map = useMap()
  useEffect(() => { if (delta) map.setZoom(map.getZoom() + delta) }, [delta])
  return null
}
function MapEvents({ onMoveEnd }: { onMoveEnd: () => void }) {
  useMapEvents({ moveend: onMoveEnd, zoomend: onMoveEnd })
  return null
}

function alertIcon(level: VigilanceLevel) {
  return L.divIcon({
    className: 'alert-pin-wrap',
    html: `<span class="alert-pin" style="--c:${LEVEL_COLOR[level]}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}

function Sparkline({ values, color, height = 34 }: { values: number[]; color: string; height?: number }) {
  if (!values.length) return null
  const max = Math.max(...values, 0.1)
  const min = Math.min(...values)
  const range = max - min || 1
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ')
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export default function MapPage() {
  const { t, lang, setLang } = useI18n()
  const { warnings, loading, error, deptColors, lastSent, updatedAt } = useVigilance()
  const radarFrames = useRadar()
  const [boltOn, setBoltOn] = useState(false)
  const lightning = useLightning(boltOn)
  const [geo, setGeo] = useState<any>(null)
  const [radarOn, setRadarOn] = useState(false)
  const [frameIdx, setFrameIdx] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [selected, setSelected] = useState<{ name: string; code: string } | null>(null)
  const [point, setPoint] = useState<{ lat: number; lon: number } | null>(null)
  const [center, setCenter] = useState<[number, number] | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [centroids, setCentroids] = useState<Record<string, [number, number]>>({})
  const [hovered, setHovered] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const [zoomDelta, setZoomDelta] = useState(0)
  const [notifyOn, setNotifyOn] = useState(false)
  const [toasts, setToasts] = useState<{ id: string; headline: string; level: VigilanceLevel }[]>([])
  const [windOn, setWindOn] = useState(false)
  const [windPoints, setWindPoints] = useState<WindPoint[]>([])
  const [floodsOn, setFloodsOn] = useState(false)
  const [floodStations, setFloodStations] = useState<FloodStation[]>([])
  const [floodLoading, setFloodLoading] = useState(false)
  
  const [watched, setWatched] = useState<string[]>(() => JSON.parse(localStorage.getItem('watched') || '[]'))
  const [history, setHistory] = useState<number[]>(() => JSON.parse(localStorage.getItem('alertHistory') || '[]'))
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('theme') as 'dark' | 'light') || 'dark')
  const [lvlFilter, setLvlFilter] = useState<number[]>([])
  const [phenoFilter, setPhenoFilter] = useState<string>('all')
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('theme', theme) }, [theme])
  const { data: weather, loading: wLoading } = useWeather(point?.lat ?? null, point?.lon ?? null)
  const ivRef = useRef<number | null>(null)
  const seenIds = useRef<Set<string> | null>(null)

  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv) }, [])
  useEffect(() => { fetch(GEOJSON_URL).then((r) => r.json()).then(setGeo).catch(() => {}) }, [])

  useEffect(() => {
    if (radarOn && playing && radarFrames.length > 0) {
      ivRef.current = window.setInterval(() => setFrameIdx((i) => (i + 1) % radarFrames.length), 700)
      return () => { if (ivRef.current) clearInterval(ivRef.current) }
    }
  }, [radarOn, playing, radarFrames.length])
  useEffect(() => { if (radarFrames.length && frameIdx === 0) setFrameIdx(radarFrames.length - 1) }, [radarFrames.length])

  useEffect(() => {
    if (!warnings.length) return
    if (seenIds.current === null) {
      seenIds.current = new Set(warnings.map((w) => w.id))
      return
    }
    const fresh = warnings.filter((w) => w.level >= 3 && !seenIds.current!.has(w.id))
    fresh.forEach((w) => {
      seenIds.current!.add(w.id)
      const touchesWatched = w.areas.some((a) => watched.includes(a))
      if (touchesWatched || !watched.length) {
        setToasts((ts) => [...ts.slice(-2), { id: w.id, headline: w.headline, level: w.level }])
        if (notifyOn && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('⚠️ ' + w.headline, { body: w.areas.slice(0, 6).join(', ') })
        }
      }
    })
    warnings.forEach((w) => seenIds.current!.add(w.id))
  }, [warnings, notifyOn])

  // alert history (localStorage, last 48 entries)
  useEffect(() => {
    if (!warnings.length || !updatedAt) return
    setHistory((h) => {
      const last = h[h.length - 1]
      const count = warnings.filter((w) => w.level >= 2).length
      if (last === count && h.length && Date.now() - new Date(updatedAt).getTime() < 90 * 1000) return h
      const next = [...h, count].slice(-48)
      localStorage.setItem('alertHistory', JSON.stringify(next))
      return next
    })
  }, [updatedAt])

  const enableNotifications = async () => {
    if (!('Notification' in window)) return
    if (Notification.permission !== 'granted') await Notification.requestPermission()
    setNotifyOn(Notification.permission === 'granted' ? !notifyOn : false)
  }

  const toggleWatch = (name: string) => {
    setWatched((w) => {
      const next = w.includes(name) ? w.filter((x) => x !== name) : [...w, name]
      localStorage.setItem('watched', JSON.stringify(next))
      return next
    })
  }

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const id = setTimeout(() => {
      fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=${lang}&country=FR`)
        .then((r) => r.json()).then((j) => setResults(j.results || [])).catch(() => {})
    }, 300)
    return () => clearTimeout(id)
  }, [query, lang])

  // wind grid with auto-refresh (10 min)
  useEffect(() => {
    if (!windOn) return
    const load = () => {
      const lats: number[] = []
      const lons: number[] = []
      for (let lat = 51.4; lat >= 41.8; lat -= 0.8) for (let lon = -5.0; lon <= 9.8; lon += 0.85) { lats.push(+lat.toFixed(2)); lons.push(+lon.toFixed(2)) }
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lats.join(',')}&longitude=${lons.join(',')}&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m`)
        .then((r) => r.json())
        .then((j) => {
          const arr = Array.isArray(j) ? j : [j]
          setWindPoints(arr.map((d: any, i: number) => ({
            lat: lats[i], lon: lons[i],
            speed: d.current?.wind_speed_10m ?? 0,
            dir: d.current?.wind_direction_10m ?? 0,
            gusts: d.current?.wind_gusts_10m ?? 0,
          })))
        })
        .catch(() => {})
    }
    load()
    const iv = setInterval(load, 10 * 60 * 1000)
    return () => clearInterval(iv)
  }, [windOn])

  // floods: stations in viewport
  useEffect(() => {
    if (!floodsOn) return
    let cancelled = false
    const load = async () => {
      try {
        setFloodLoading(true)
        const c = document.querySelector('.leaflet-container') as any
        const bbox = c?._leaflet_map?.bbox || '-5,41.3,9.8,51.3'
        const data = await fetchFloodStations(bbox)
        if (!cancelled) setFloodStations(data)
      } catch {} finally { if (!cancelled) setFloodLoading(false) }
    }
    load()
    const iv = setInterval(load, 15 * 60 * 1000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [floodsOn])

  const handleMoveEnd = () => {
    
    // store bbox on the container for the flood loader
    const c = document.querySelector('.leaflet-container') as any
    if (c && (window as any).__leafletMap) {
      const b = (window as any).__leafletMap.getBounds()
      c._leaflet_map = { bbox: `${b.getWest().toFixed(2)},${b.getSouth().toFixed(2)},${b.getEast().toFixed(2)},${b.getNorth().toFixed(2)}` }
    }
  }

  // grouped by department, with filters
  const phenoName = (ev: string) => {
    const e = ev.toLowerCase()
    if (e.includes('orage')) return t.storm
    if (e.includes('pluie')) return t.rain_flood
    if (e.includes('inond')) return t.flood_r
    if (e.includes('vent')) return t.wind_v
    if (e.includes('neige') || e.includes('verglas')) return t.snow
    if (e.includes('vague')) return t.waves_s
    if (e.includes('froid')) return t.cold_e
    if (e.includes('canicule')) return t.heat_w
    if (e.includes('avalanche')) return t.avalanche
    return ev
  }

  const grouped = useMemo(() => {
    const m = new Map<string, { name: string; level: VigilanceLevel; items: typeof warnings }>()
    warnings.filter((w) => w.level >= 2).forEach((w) => {
      if (lvlFilter.length && !lvlFilter.includes(w.level)) return
      if (phenoFilter !== 'all' && phenoName(w.event) !== phenoFilter) return
      w.areas.forEach((name) => {
        const g = m.get(name) || { name, level: 1 as VigilanceLevel, items: [] }
        if (w.level > g.level) g.level = w.level
        g.items.push(w)
        m.set(name, g)
      })
    })
    return [...m.values()].sort((a, b) => b.level - a.level || b.items.length - a.items.length)
  }, [warnings, lvlFilter, phenoFilter])

  // upcoming (J+1)
  const upcoming = useMemo(() => {
    const nowT = Date.now()
    const seen = new Set<string>()
    return warnings
      .filter((w) => w.onset && new Date(w.onset).getTime() > nowT + 30 * 60 * 1000)
      .filter((w) => { const k = w.headline; if (seen.has(k)) return false; seen.add(k); return true })
      .sort((a, b) => b.level - a.level)
  }, [warnings])

  const counts = useMemo(() => {
    const c: Record<number, number> = { 2: 0, 3: 0, 4: 0 }
    Object.values(deptColors).forEach((l) => { if (l >= 2) c[l] = (c[l] || 0) + 1 })
    return c
  }, [deptColors])

  const maxLevel = useMemo(() => Math.max(0, ...Object.values(deptColors)), [deptColors])

  const styleFor = (feature: any, hover: boolean) => {
    const code = String(feature?.properties?.code || '')
    const lvl = (deptColors[code] || 1) as VigilanceLevel
    return { color: hover ? '#ffffff' : 'rgba(255,255,255,0.25)', weight: hover ? 2.4 : 1, fillColor: LEVEL_COLOR[lvl], fillOpacity: lvl === 1 ? 0.12 : hover ? 0.62 : 0.45 }
  }

  const onEachFeature = (feature: any, layer: any) => {
    const name = feature?.properties?.name || ''
    const code = String(feature?.properties?.code || '')
    layer.on({
      click: () => {
        setSelected({ name, code })
        const c = layer.getBounds().getCenter()
        setPoint({ lat: c.lat, lon: c.lng })
      },
      mouseover: () => { setHovered(code); layer.setStyle(styleFor(feature, true)) },
      mouseout: () => { setHovered(null); layer.setStyle(styleFor(feature, false)) },
    })
    layer.bindTooltip(`${name} (${code})`, { sticky: true })
    const c = layer.getBounds().getCenter()
    setCentroids((prev) => (prev[code] ? prev : { ...prev, [code]: [c.lat, c.lng] }))
  }

  const radarUrl = radarOn ? radarTileUrl(radarFrames[frameIdx]) : null
  const frameTime = radarFrames[frameIdx]?.time
  const nextIn = updatedAt ? Math.max(0, REFRESH_S - Math.round((now - new Date(updatedAt).getTime()) / 1000)) : REFRESH_S
  const lastSentAgo = lastSent ? Math.max(0, Math.round((now - new Date(lastSent).getTime()) / 60000)) : null
  const selectedAlerts = selected ? warnings.filter((w) => w.level >= 2 && w.areas.includes(selected.name)) : []
  const isWatched = selected ? watched.includes(selected.name) : false
  const watchedAlerts = warnings.filter((w) => w.level >= 2 && w.areas.some((a) => watched.includes(a)))

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <style>{`
        .alert-pin { display:block; width:18px; height:18px; border-radius:50%; background:var(--c); border:2px solid rgba(255,255,255,.85); animation: pinPulse 1.6s infinite; }
        @keyframes pinPulse { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--c) 70%, transparent); } 70% { box-shadow: 0 0 0 14px transparent; } 100% { box-shadow: 0 0 0 0 transparent; } }
        @media (max-width: 760px) {
          .side-panel { top: auto !important; bottom: 0 !important; left: 0 !important; right: 0 !important; width: 100% !important; max-height: 46vh !important; }
          .side-panel .glass { border-radius: 18px 18px 0 0 !important; }
          .topbar-center { display: none !important; }
        }
      `}</style>

      <MapContainer center={[46.8, 2.5]} zoom={6.4} zoomSnap={0.25} style={{ height: '100%', width: '100%' }} zoomControl={false}
        ref={(m: any) => { if (m) (window as any).__leafletMap = m }}>
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {geo && <GeoJSON key={JSON.stringify(deptColors)} data={geo} style={(f: any) => styleFor(f, hovered === String(f?.properties?.code))} onEachFeature={onEachFeature} />}
        {radarUrl && <TileLayer url={radarUrl} opacity={0.65} />}
        {windOn && <WindLayer points={windPoints} />}
        {floodsOn && floodStations.map((s) => (
          <CircleMarker key={s.code} center={[s.lat, s.lon]} radius={5}
            pathOptions={{ color: '#4aa3ff', fillColor: s.h != null && s.h > 3 ? '#ff7a1a' : '#4aa3ff', fillOpacity: 0.9, weight: 1.5 }}
            eventHandlers={{ click: () => setPoint({ lat: s.lat, lon: s.lon }) }}>
            <Tooltip direction="top">{s.name} · {s.h != null ? `${s.h.toFixed(2)} m` : 'n/a'}</Tooltip>
          </CircleMarker>
        ))}
        {boltOn && lightning.map((s, i) => (
          <Marker key={`${s.time}-${i}`} position={[s.lat, s.lon]} interactive={false}
            icon={L.divIcon({ className: 'bolt-wrap', html: '<span class="bolt-icon">⚡</span>', iconSize: [16, 16], iconAnchor: [8, 8] })} />
        ))}
        {CITIES.map((c) => (
          <Marker key={c.name} position={[c.lat, c.lon]} interactive={false}
            icon={L.divIcon({ className: 'city-label-wrap', html: `<span class="city-label" style="font-size:${c.pop > 400000 ? 13 : c.pop > 80000 ? 11 : 9.5}px">${c.name}</span>`, iconSize: [0, 0], iconAnchor: [0, 4] })} />
        ))}
        {Object.entries(centroids).map(([code, c]) => {
          const lvl = deptColors[code]
          if (!lvl || lvl < 2) return null
          return <Marker key={code} position={c} icon={alertIcon(lvl)} eventHandlers={{ click: () => setSelected({ name: code, code }) }} />
        })}
        <MapController center={center} zoom={9} />
        <Zoomer delta={zoomDelta} />
        <MapEvents onMoveEnd={handleMoveEnd} />
      </MapContainer>

      {/* TOP BAR */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex items-center gap-2 fade-in pointer-events-none">
        <div className="glass rounded-xl px-4 py-2.5 flex items-center gap-3 shadow-lg pointer-events-auto">
          <a href="/" className="text-lg font-extrabold tracking-tight"><span className="text-[var(--accent)]">Météo</span>Live</a>
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--ok)] px-2 py-0.5 rounded-full border border-[var(--ok)]/40">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--ok)] pulse-dot inline-block" />{t.live}
          </span>
          <span className="hidden md:flex items-center gap-1.5 text-[10px] text-[var(--muted)] border-l border-white/10 pl-3">
            <Clock size={11} />
            {new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            <span>· -{nextIn}s</span>
          </span>
          {lastSentAgo !== null && (
            <span className="hidden lg:inline text-[10px] text-[var(--muted)] border-l border-white/10 pl-3">
              {lang === 'fr' ? `bulletin il y a ${lastSentAgo} min` : `bulletin ${lastSentAgo} min ago`}
            </span>
          )}
        </div>

        <div className="glass rounded-xl flex-1 max-w-md relative shadow-lg pointer-events-auto topbar-center">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-transparent outline-none text-sm px-9 py-2.5 placeholder:text-[var(--muted)] text-[var(--text)]" placeholder={t.search_ph} />
          {results.length > 0 && (
            <div className="absolute top-full mt-1 left-0 right-0 glass rounded-xl overflow-hidden shadow-xl">
              {results.map((r, i) => (
                <button key={i} className="block w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 text-[var(--text)]"
                  onClick={() => { setCenter([r.latitude, r.longitude]); setPoint({ lat: r.latitude, lon: r.longitude }); setQuery(r.name); setResults([]) }}>
                  {r.name}, {r.admin1 || ''}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="glass rounded-xl flex items-center shadow-lg pointer-events-auto ml-auto">
          <button onClick={() => setRadarOn(!radarOn)} className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold ${radarOn ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`}>
            <RadarIcon size={14} />{t.radar}
          </button>
          <div className="w-px h-5 bg-white/10" />
          <button onClick={() => setWindOn(!windOn)} className={`px-3 py-2.5 text-xs font-semibold ${windOn ? 'text-[#4aa3ff]' : 'text-[var(--muted)]'}`}>
            {lang === 'fr' ? 'Vent' : 'Wind'}
          </button>
          <div className="w-px h-5 bg-white/10" />
          <button onClick={() => setFloodsOn(!floodsOn)} className={`flex items-center gap-1 px-3 py-2.5 text-xs font-semibold ${floodsOn ? 'text-[#4aa3ff]' : 'text-[var(--muted)]'}`}>
            <Waves size={14} />{t.floods}
          </button>
          <div className="w-px h-5 bg-white/10" />
          <button onClick={() => setBoltOn(!boltOn)} className={`flex items-center gap-1 px-3 py-2.5 text-xs font-semibold ${boltOn ? 'text-[var(--warn)]' : 'text-[var(--muted)]'}`}>
            <Zap size={14} />{boltOn ? lightning.length : t.bolts}
          </button>
          <div className="w-px h-5 bg-white/10" />
          <button onClick={enableNotifications} className={`px-2.5 py-2.5 ${notifyOn ? 'text-[var(--ok)]' : 'text-[var(--muted)] hover:text-white'}`} title="Notifications">
            {notifyOn ? <Bell size={14} /> : <BellOff size={14} />}
          </button>
          <div className="w-px h-5 bg-white/10" />
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="px-2.5 py-2.5 text-[var(--muted)] hover:text-white" title="Theme">
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <div className="w-px h-5 bg-white/10" />
          <button onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')} className="px-3 py-2.5 text-xs font-semibold text-[var(--muted)] hover:text-white">
            {lang === 'fr' ? 'EN' : 'FR'}
          </button>
        </div>
      </div>

      {/* TOASTS */}
      <div className="absolute top-[76px] left-1/2 -translate-x-1/2 z-[1100] space-y-2 pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className="glass rounded-xl px-4 py-2.5 shadow-2xl fade-in flex items-center gap-2.5" style={{ borderLeft: `4px solid ${LEVEL_COLOR[toast.level]}` }}>
            <span className="w-2 h-2 rounded-full pulse-dot" style={{ background: LEVEL_COLOR[toast.level] }} />
            <span className="text-xs font-semibold" style={{ color: LEVEL_COLOR[toast.level] }}>{toast.headline}</span>
            <button onClick={() => setToasts((ts) => ts.filter((x) => x.id !== toast.id))} className="text-[var(--muted)] hover:text-white"><X size={12} /></button>
          </div>
        ))}
      </div>

      {/* RIGHT PANEL */}
      <div className="side-panel absolute top-[72px] right-3 z-[1000] w-[340px] max-h-[calc(100vh-150px)] flex flex-col gap-2 fade-in pointer-events-none">
        {selected ? (
          <div className="glass rounded-2xl p-4 shadow-xl overflow-auto pointer-events-auto">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-[var(--muted)]">{t.department}</div>
                <div className="text-xl font-bold">{selected.name} <span className="text-[var(--muted)] text-sm">{selected.code}</span></div>
                <div className="mt-1 flex items-center gap-2">
                  {(() => { const l = (deptColors[selected.code] || 1) as VigilanceLevel; return (
                    <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: LEVEL_COLOR[l] }}>
                      <span className="w-2 h-2 rounded-full" style={{ background: LEVEL_COLOR[l] }} />
                      {l === 1 ? t.watch_d : l === 2 ? t.watch_d : l === 3 ? t.orange_d : t.red_d}
                    </span>
                  )})()}
                  <button onClick={() => toggleWatch(selected.name)} className={`text-[10px] font-semibold flex items-center gap-1 px-2 py-0.5 rounded-full border ${isWatched ? 'border-[var(--warn)] text-[var(--warn)]' : 'border-white/15 text-[var(--muted)]'}`}>
                    <Star size={10} fill={isWatched ? 'currentColor' : 'none'} />{isWatched ? t.watching : t.watch}
                  </button>
                </div>
              </div>
              <button onClick={() => { setSelected(null); setPoint(null) }} className="text-[var(--muted)] hover:text-white"><X size={16} /></button>
            </div>
            {wLoading && <div className="text-xs text-[var(--muted)] mt-3">{t.loading}</div>}
            {weather && (
              <div className="mt-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold display">{Math.round(weather.current.temp)}°</span>
                  <span className="text-2xl">{WMO[weather.current.code] || '🌡️'}</span>
                  <span className="ml-auto text-[10px] text-[var(--muted)] text-right">
                    💧{weather.current.humidity}%<br />{Math.round(weather.current.pressure)} hPa
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <div className="text-[9px] uppercase text-[var(--muted)]">{t.wind}</div>
                    <div className="text-sm font-bold">{Math.round(weather.current.wind)}<span className="text-[9px] text-[var(--muted)]"> km/h</span></div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <div className="text-[9px] uppercase text-[var(--muted)]">{t.gusts}</div>
                    <div className="text-sm font-bold">{Math.round(weather.current.gusts)}<span className="text-[9px] text-[var(--muted)]"> km/h</span></div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <div className="text-[9px] uppercase text-[var(--muted)]">{t.precip}</div>
                    <div className="text-sm font-bold">{weather.current.precip}<span className="text-[9px] text-[var(--muted)]"> mm</span></div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-[10px] uppercase tracking-widest text-[var(--muted)] mb-1">24h</div>
                  <Sparkline values={weather.hourly.temp.slice(0, 24)} color="#ffb020" />
                  <Sparkline values={weather.hourly.precip.slice(0, 24)} color="#4aa3ff" height={22} />
                  <div className="flex gap-1.5 overflow-x-auto pb-1 mt-1">
                    {weather.hourly.time.slice(0, 12).map((tm, i) => (
                      <div key={i} className="bg-white/5 rounded-lg px-2 py-1.5 text-center min-w-[46px]">
                        <div className="text-[9px] text-[var(--muted)]">{tm.slice(11, 13)}h</div>
                        <div className="text-xs font-bold">{Math.round(weather.hourly.temp[i])}°</div>
                        <div className="text-[8px] text-[#4aa3ff]">{(weather.hourly as any).pop?.[i] != null ? `${(weather.hourly as any).pop[i]}%` : '·'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {selectedAlerts.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {selectedAlerts.map((w) => (
                  <div key={w.id} className="rounded-lg p-2 text-xs" style={{ background: `${LEVEL_COLOR[w.level]}18`, borderLeft: `3px solid ${LEVEL_COLOR[w.level]}` }}>
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold" style={{ color: LEVEL_COLOR[w.level] }}>{w.headline}</span>
                      <span className="text-[9px] text-[var(--muted)] whitespace-nowrap font-mono">{w.expires?.slice(11, 16)} {w.expires?.slice(5, 10)}</span>
                    </div>
                    <div className="text-[var(--muted)] mt-0.5">{w.instruction}</div>
                    {w.description && <div className="text-[var(--muted)] mt-1 opacity-80">{w.description}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="glass rounded-2xl p-3 shadow-xl overflow-auto pointer-events-auto">
            <div className="flex items-center justify-between px-1 pb-2">
              <div className="text-[10px] uppercase tracking-widest text-[var(--muted)]">{t.active_alerts}</div>
              <div className="flex items-center gap-2">
                {history.length > 2 && (
                  <span className="flex items-center gap-1 text-[9px] text-[var(--muted)]"><TrendingUp size={10} />{t.trend}</span>
                )}
                {maxLevel >= 2 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${LEVEL_COLOR[maxLevel as VigilanceLevel]}22`, color: LEVEL_COLOR[maxLevel as VigilanceLevel] }}>
                    {warnings.filter((w) => w.level >= 2).length}
                  </span>
                )}
              </div>
            </div>
            {history.length > 2 && <div className="px-1 pb-2"><Sparkline values={history} color="#ff7a1a" height={22} /></div>}
            {watched.length > 0 && (
              <div className="mb-2">
                <div className="text-[9px] uppercase tracking-widest text-[var(--warn)] px-1 pb-1 flex items-center gap-1">
                  <Star size={9} fill="currentColor" />{t.watching} ({watchedAlerts.length})
                </div>
                {watchedAlerts.length === 0 ? (
                  <div className="text-[10px] text-[var(--muted)] px-1 pb-1">✅ {t.no_alerts}</div>
                ) : watchedAlerts.slice(0, 3).map((w) => (
                  <div key={w.id} className="text-[10px] px-2 py-1 rounded mb-0.5" style={{ background: `${LEVEL_COLOR[w.level]}18`, color: LEVEL_COLOR[w.level] }}>
                    {w.areas.filter((a) => watched.includes(a)).join(', ')} · {w.headline}
                  </div>
                ))}
              </div>
            )}
            {loading && (
              <div className="space-y-2 p-1">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="skel h-[52px] w-full" />
                ))}
              </div>
            )}
            {error && <div className="text-xs text-[var(--red)] p-2">{error}</div>}
            {!loading && grouped.length === 0 && <div className="text-xs text-[var(--muted)] p-2">{t.no_alerts}</div>}
            {/* FILTERS */}
            {!loading && (
              <div className="flex items-center gap-1.5 flex-wrap px-1 pb-2">
                {([2, 3, 4] as VigilanceLevel[]).map((l) => (
                  <button key={l} onClick={() => setLvlFilter((f) => (f.includes(l) ? f.filter((x) => x !== l) : [...f, l]))}
                    className={`text-[9px] font-bold px-2 py-1 rounded-full border transition ${lvlFilter.includes(l) ? 'text-white' : 'text-[var(--muted)]'}`}
                    style={lvlFilter.includes(l) ? { background: LEVEL_COLOR[l], borderColor: LEVEL_COLOR[l] } : { borderColor: 'var(--border)' }}>
                    {l === 2 ? t.yellow : l === 3 ? t.orange : t.red}
                  </button>
                ))}
                <select value={phenoFilter} onChange={(e) => setPhenoFilter(e.target.value)}
                  className="text-[9px] font-semibold ml-auto bg-[var(--surface)] border border-[var(--border)] rounded-full px-2 py-1 outline-none text-[var(--text)]">
                  <option value="all">{t.filter_all}</option>
                  {[t.storm, t.rain_flood, t.flood_r, t.wind_v, t.snow, t.waves_s, t.cold_e, t.heat_w].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              {grouped.map((g) => (
                <button key={g.name} onClick={() => setSelected({ name: g.name, code: Object.entries(centroids).find(([c]) => deptColors[c] === g.level)?.[0] || '' })}
                  className="block w-full text-left rounded-xl p-2.5 hover:bg-white/5 transition" style={{ borderLeft: `3px solid ${LEVEL_COLOR[g.level]}` }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[var(--text)]">{g.name}</span>
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded tnum" style={{ background: `${LEVEL_COLOR[g.level]}22`, color: LEVEL_COLOR[g.level] }}>
                      {g.items.length}
                    </span>
                  </div>
                  <div className="text-[10px] mt-0.5 truncate" style={{ color: LEVEL_COLOR[g.level] }}>
                    {[...new Set(g.items.map((w) => phenoName(w.event)))].join(' · ')}
                  </div>
                </button>
              ))}
            </div>
            {upcoming.length > 0 && (
              <div className="mt-3 pt-2 border-t border-white/10">
                <div className="text-[9px] uppercase tracking-widest text-[var(--accent-2)] px-1 pb-1.5">{t.tomorrow}</div>
                {upcoming.slice(0, 4).map((w) => (
                  <div key={w.id} className="text-[10px] px-2 py-1.5 rounded mb-0.5 flex items-center justify-between gap-2" style={{ background: `${LEVEL_COLOR[w.level]}12`, color: LEVEL_COLOR[w.level] }}>
                    <span className="truncate">{w.headline}</span>
                    <span className="text-[9px] text-[var(--muted)] whitespace-nowrap font-mono">{w.onset?.slice(5, 16).replace('T', ' ')}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="text-[9px] text-[var(--muted)] text-center pt-2">{t.click_dept}</div>
          </div>
        )}
      </div>

      {/* LEGEND */}
      <div className="absolute bottom-4 left-3 z-[1000] glass rounded-xl px-3 py-2 flex items-center gap-3 shadow-lg fade-in flex-wrap max-w-[calc(100vw-24px)]">
        {([2, 3, 4] as VigilanceLevel[]).map((l) => (
          <span key={l} className="flex items-center gap-1.5 text-[10px] font-medium">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: LEVEL_COLOR[l] }} />
            {l === 2 ? t.yellow : l === 3 ? t.orange : t.red}
            <span className="text-[var(--muted)]">· {counts[l] || 0}</span>
          </span>
        ))}
        {floodsOn && <span className="flex items-center gap-1 text-[10px] text-[#4aa3ff]"><Waves size={10} />{t.river_level}{floodLoading ? '…' : ` · ${floodStations.length}`}</span>}
        {boltOn && <span className="flex items-center gap-1 text-[10px] text-[var(--warn)]"><Zap size={10} />{lightning.length} · 30min</span>}
        {updatedAt && <span className="text-[9px] text-[var(--muted)] border-l border-white/10 pl-3">{t.updated} {new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
        <a href="/app/alerts" className="text-[9px] text-[var(--accent)] flex items-center gap-1 border-l border-white/10 pl-3"><LinkIcon size={9} />{t.nav_alerts}</a>
      </div>

      {/* ZOOM */}
      <div className="absolute right-3 bottom-24 z-[1000] flex flex-col gap-2">
        <button onClick={() => setZoomDelta((d) => d + 1)} className="glass rounded-xl w-9 h-9 flex items-center justify-center shadow-lg text-white hover:text-[var(--accent)]"><Plus size={16} /></button>
        <button onClick={() => setZoomDelta((d) => d - 1)} className="glass rounded-xl w-9 h-9 flex items-center justify-center shadow-lg text-white hover:text-[var(--accent)]"><Minus size={16} /></button>
        <button onClick={() => { if (navigator.geolocation) navigator.geolocation.getCurrentPosition((p) => setCenter([p.coords.latitude, p.coords.longitude])) }}
          className="glass rounded-xl w-9 h-9 flex items-center justify-center shadow-lg text-white hover:text-[var(--accent)]"><Crosshair size={16} /></button>
      </div>

      {/* RADAR PLAYER */}
      {radarOn && radarFrames.length > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] glass rounded-xl px-4 py-2.5 flex items-center gap-3 shadow-xl fade-in max-w-[92vw]">
          <button onClick={() => setPlaying(!playing)} className="text-white hover:text-[var(--accent)]">
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <input type="range" min={0} max={radarFrames.length - 1} value={frameIdx}
            onChange={(e) => { setPlaying(false); setFrameIdx(Number(e.target.value)) }}
            className="w-40 md:w-56 accent-[var(--accent)]" />
          <span className="text-[10px] text-[var(--muted)] font-mono w-10">{frameTime ? new Date(frameTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
        </div>
      )}
    </div>
  )
}
