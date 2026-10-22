import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Search, Play, Pause, X, Radar as RadarIcon, Plus, Minus, Crosshair, Bell, BellOff, Clock } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import { useI18n } from '../contexts/I18nContext'
import { useVigilance, type VigilanceLevel } from '../lib/useVigilance'
import { useRadar, radarTileUrl } from '../lib/useRadar'
import { useWeather } from '../lib/useWeather'

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
      setToasts((ts) => [...ts.slice(-2), { id: w.id, headline: w.headline, level: w.level }])
      if (notifyOn && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('⚠️ ' + w.headline, { body: w.areas.slice(0, 6).join(', ') })
      }
    })
    warnings.forEach((w) => seenIds.current!.add(w.id))
  }, [warnings, notifyOn])

  const enableNotifications = async () => {
    if (!('Notification' in window)) return
    if (Notification.permission !== 'granted') await Notification.requestPermission()
    setNotifyOn(Notification.permission === 'granted' ? !notifyOn : false)
  }

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const id = setTimeout(() => {
      fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=${lang}&country=FR`)
        .then((r) => r.json()).then((j) => setResults(j.results || [])).catch(() => {})
    }, 300)
    return () => clearTimeout(id)
  }, [query, lang])

  const activeWarnings = useMemo(() => {
    const seen = new Set<string>()
    return warnings.filter((w) => w.level >= 2).filter((w) => { const k = w.event + w.level; if (seen.has(k)) return false; seen.add(k); return true }).sort((a, b) => b.level - a.level)
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

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <style>{`
        .alert-pin { display:block; width:18px; height:18px; border-radius:50%; background:var(--c); border:2px solid rgba(255,255,255,.85); animation: pinPulse 1.6s infinite; }
        @keyframes pinPulse { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--c) 70%, transparent); } 70% { box-shadow: 0 0 0 14px transparent; } 100% { box-shadow: 0 0 0 0 transparent; } }
      `}</style>

      <MapContainer center={[46.8, 2.5]} zoom={6.4} zoomSnap={0.25} style={{ height: '100%', width: '100%' }} zoomControl={false}>
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {geo && <GeoJSON key={JSON.stringify(deptColors)} data={geo} style={(f: any) => styleFor(f, hovered === String(f?.properties?.code))} onEachFeature={onEachFeature} />}
        {radarUrl && <TileLayer url={radarUrl} opacity={0.65} />}
        {Object.entries(centroids).map(([code, c]) => {
          const lvl = deptColors[code]
          if (!lvl || lvl < 2) return null
          return <Marker key={code} position={c} icon={alertIcon(lvl)} eventHandlers={{ click: () => setSelected({ name: code, code }) }} />
        })}
        <MapController center={center} zoom={9} />
        <Zoomer delta={zoomDelta} />
      </MapContainer>

      {/* TOP BAR */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex items-center gap-2 fade-in pointer-events-none">
        <div className="glass rounded-xl px-4 py-2.5 flex items-center gap-3 shadow-lg pointer-events-auto">
          <span className="text-lg font-extrabold tracking-tight"><span className="text-[var(--accent)]">Météo</span>Live</span>
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

        <div className="glass rounded-xl flex-1 max-w-md relative shadow-lg pointer-events-auto">
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

        <div className="glass rounded-xl flex items-center shadow-lg pointer-events-auto">
          <button onClick={() => setRadarOn(!radarOn)} className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold ${radarOn ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`}>
            <RadarIcon size={14} />{t.radar}
          </button>
          <div className="w-px h-5 bg-white/10" />
          <button onClick={enableNotifications} className={`px-2.5 py-2.5 ${notifyOn ? 'text-[var(--ok)]' : 'text-[var(--muted)] hover:text-white'}`} title="Notifications">
            {notifyOn ? <Bell size={14} /> : <BellOff size={14} />}
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
      <div className="absolute top-[72px] right-3 z-[1000] w-[340px] max-h-[calc(100vh-150px)] flex flex-col gap-2 fade-in pointer-events-none">
        {selected ? (
          <div className="glass rounded-2xl p-4 shadow-xl overflow-auto pointer-events-auto">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-[var(--muted)]">{t.department}</div>
                <div className="text-xl font-bold">{selected.name} <span className="text-[var(--muted)] text-sm">{selected.code}</span></div>
                {(() => { const l = (deptColors[selected.code] || 1) as VigilanceLevel; return (
                  <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold" style={{ color: LEVEL_COLOR[l] }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: LEVEL_COLOR[l] }} />
                    {l === 1 ? t.watch_d : l === 2 ? t.watch_d : l === 3 ? t.orange_d : t.red_d}
                  </div>
                )})()}
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
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="glass rounded-2xl p-3 shadow-xl overflow-auto pointer-events-auto">
            <div className="flex items-center justify-between px-1 pb-2">
              <div className="text-[10px] uppercase tracking-widest text-[var(--muted)]">{t.active_alerts}</div>
              {maxLevel >= 2 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${LEVEL_COLOR[maxLevel as VigilanceLevel]}22`, color: LEVEL_COLOR[maxLevel as VigilanceLevel] }}>
                  {warnings.filter((w) => w.level >= 2).length} {t.warnings_count}
                </span>
              )}
            </div>
            {loading && <div className="text-xs text-[var(--muted)] p-2">{t.loading}</div>}
            {error && <div className="text-xs text-[var(--red)] p-2">{error}</div>}
            {!loading && activeWarnings.length === 0 && <div className="text-xs text-[var(--muted)] p-2">{t.no_alerts}</div>}
            <div className="space-y-1.5">
              {activeWarnings.map((w) => (
                <button key={w.id} onClick={() => { if (w.areas[0]) setSelected({ name: w.areas[0], code: '' }) }}
                  className="block w-full text-left rounded-xl p-2.5 hover:bg-white/5 transition" style={{ borderLeft: `3px solid ${LEVEL_COLOR[w.level]}` }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold" style={{ color: LEVEL_COLOR[w.level] }}>{w.headline}</span>
                    <span className="text-[9px] text-[var(--muted)] whitespace-nowrap">{w.expires?.slice(0, 10)}</span>
                  </div>
                  <div className="text-[10px] text-[var(--muted)] mt-0.5 truncate">{w.areas.slice(0, 5).join(', ')}{w.areas.length > 5 ? ` +${w.areas.length - 5}` : ''}</div>
                </button>
              ))}
            </div>
            <div className="text-[9px] text-[var(--muted)] text-center pt-2">{t.click_dept}</div>
          </div>
        )}
      </div>

      {/* LEGEND */}
      <div className="absolute bottom-4 left-3 z-[1000] glass rounded-xl px-3 py-2 flex items-center gap-3 shadow-lg fade-in">
        {([2, 3, 4] as VigilanceLevel[]).map((l) => (
          <span key={l} className="flex items-center gap-1.5 text-[10px] font-medium">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: LEVEL_COLOR[l] }} />
            {l === 2 ? t.yellow : l === 3 ? t.orange : t.red}
            <span className="text-[var(--muted)]">· {counts[l] || 0}</span>
          </span>
        ))}
        {updatedAt && <span className="text-[9px] text-[var(--muted)] border-l border-white/10 pl-3">{t.updated} {new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
      </div>

      {/* ZOOM + LOCATE */}
      <div className="absolute right-3 bottom-24 z-[1000] flex flex-col gap-2">
        <button onClick={() => setZoomDelta((d) => d + 1)} className="glass rounded-xl w-9 h-9 flex items-center justify-center shadow-lg text-white hover:text-[var(--accent)]"><Plus size={16} /></button>
        <button onClick={() => setZoomDelta((d) => d - 1)} className="glass rounded-xl w-9 h-9 flex items-center justify-center shadow-lg text-white hover:text-[var(--accent)]"><Minus size={16} /></button>
        <button onClick={() => { if (navigator.geolocation) navigator.geolocation.getCurrentPosition((p) => setCenter([p.coords.latitude, p.coords.longitude])) }}
          className="glass rounded-xl w-9 h-9 flex items-center justify-center shadow-lg text-white hover:text-[var(--accent)]"><Crosshair size={16} /></button>
      </div>

      {/* RADAR PLAYER */}
      {radarOn && radarFrames.length > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] glass rounded-xl px-4 py-2.5 flex items-center gap-3 shadow-xl fade-in">
          <button onClick={() => setPlaying(!playing)} className="text-white hover:text-[var(--accent)]">
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <input type="range" min={0} max={radarFrames.length - 1} value={frameIdx}
            onChange={(e) => { setPlaying(false); setFrameIdx(Number(e.target.value)) }}
            className="w-56 accent-[var(--accent)]" />
          <span className="text-[10px] text-[var(--muted)] font-mono w-10">{frameTime ? new Date(frameTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
        </div>
      )}
    </div>
  )
}
