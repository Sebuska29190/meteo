import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import { Search, Play, Pause, X, Radar as RadarIcon } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import { useI18n } from '../contexts/I18nContext'
import { useVigilance, type VigilanceLevel } from '../lib/useVigilance'
import { useRadar, radarTileUrl } from '../lib/useRadar'
import { useWeather } from '../lib/useWeather'

const GEOJSON_URL = 'https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements.geojson'
const LEVEL_COLOR: Record<VigilanceLevel, string> = { 1: '#35d08c', 2: '#ffd23f', 3: '#ff7a1a', 4: '#ff2d55' }
const WMO: Record<number, string> = { 0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 51: '🌦️', 61: '🌧️', 71: '🌨️', 80: '🌦️', 95: '⛈️' }

function MapController({ center, zoom }: { center: [number, number] | null; zoom: number }) {
  const map = useMap()
  useEffect(() => { if (center) map.flyTo(center, zoom, { duration: 1.2 }) }, [center?.[0], center?.[1], zoom])
  return null
}

export default function MapPage() {
  const { t, lang, setLang } = useI18n()
  const { warnings, loading, error, deptColors, updatedAt } = useVigilance()
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
  const { data: weather, loading: wLoading } = useWeather(point?.lat ?? null, point?.lon ?? null)
  const ivRef = useRef<number | null>(null)

  useEffect(() => {
    fetch(GEOJSON_URL).then((r) => r.json()).then(setGeo).catch(() => {})
  }, [])

  useEffect(() => {
    if (radarOn && playing && radarFrames.length > 0) {
      ivRef.current = window.setInterval(() => setFrameIdx((i) => (i + 1) % radarFrames.length), 700)
      return () => { if (ivRef.current) clearInterval(ivRef.current) }
    }
  }, [radarOn, playing, radarFrames.length])
  useEffect(() => { if (radarFrames.length && frameIdx === 0) setFrameIdx(radarFrames.length - 1) }, [radarFrames.length])

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
    return warnings
      .filter((w) => w.level >= 2)
      .filter((w) => { const k = w.event + w.level; if (seen.has(k)) return false; seen.add(k); return true })
      .sort((a, b) => b.level - a.level)
  }, [warnings])

  const maxLevel = useMemo(() => Math.max(0, ...Object.values(deptColors)), [deptColors])

  const styleFn = (feature: any) => {
    const code = String(feature?.properties?.code || '')
    const lvl = (deptColors[code] || 1) as VigilanceLevel
    return { color: 'rgba(255,255,255,0.25)', weight: 1, fillColor: LEVEL_COLOR[lvl], fillOpacity: lvl === 1 ? 0.12 : 0.45 }
  }

  const onEachFeature = (feature: any, layer: any) => {
    const name = feature?.properties?.name || ''
    const code = String(feature?.properties?.code || '')
    layer.on('click', () => {
      setSelected({ name, code })
      const c = layer.getBounds().getCenter()
      setPoint({ lat: c.lat, lon: c.lng })
    })
    layer.bindTooltip(`${name} (${code})`, { sticky: true })
  }

  const radarUrl = radarOn ? radarTileUrl(radarFrames[frameIdx]) : null
  const frameTime = radarFrames[frameIdx]?.time

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <MapContainer center={[46.8, 2.5]} zoom={6.4} zoomSnap={0.25} style={{ height: '100%', width: '100%' }} zoomControl={false}>
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {geo && <GeoJSON key={JSON.stringify(deptColors)} data={geo} style={styleFn as any} onEachFeature={onEachFeature} />}
        {radarUrl && <TileLayer url={radarUrl} opacity={0.65} />}
        <MapController center={center} zoom={9} />
      </MapContainer>

      {/* TOP BAR */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex items-center gap-2 fade-in pointer-events-none">
        <div className="glass rounded-xl px-4 py-2.5 flex items-center gap-3 shadow-lg pointer-events-auto">
          <span className="text-lg font-extrabold tracking-tight"><span className="text-[var(--accent)]">Météo</span>Live</span>
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--ok)] px-2 py-0.5 rounded-full border border-[var(--ok)]/40">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--ok)] pulse-dot inline-block" />{t.live}
          </span>
        </div>

        <div className="glass rounded-xl flex-1 max-w-md relative shadow-lg pointer-events-auto">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-transparent outline-none text-sm px-9 py-2.5 placeholder:text-[var(--muted)] text-[var(--text)]"
            placeholder={t.search_ph}
          />
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
          <button onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')} className="px-3 py-2.5 text-xs font-semibold text-[var(--muted)] hover:text-white">
            {lang === 'fr' ? 'EN' : 'FR'}
          </button>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="absolute top-[72px] right-3 z-[1000] w-[340px] max-h-[calc(100vh-160px)] flex flex-col gap-2 fade-in pointer-events-none">
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
                  <div className="text-[10px] uppercase tracking-widest text-[var(--muted)] mb-1.5">{t.next_hours}</div>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {weather.hourly.time.slice(0, 12).map((tm, i) => (
                      <div key={i} className="bg-white/5 rounded-lg px-2 py-1.5 text-center min-w-[46px]">
                        <div className="text-[9px] text-[var(--muted)]">{tm.slice(11, 13)}h</div>
                        <div className="text-xs font-bold">{Math.round(weather.hourly.temp[i])}°</div>
                        <div className="text-[8px] text-[#4aa3ff]">{weather.hourly.precip[i] > 0 ? `${weather.hourly.precip[i]}mm` : '·'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {(() => {
              const deptWs = warnings.filter((w) => w.level >= 2 && w.areas.includes(selected.name))
              if (!deptWs.length) return null
              return (
                <div className="mt-3 space-y-1.5">
                  {deptWs.map((w) => (
                    <div key={w.id} className="rounded-lg p-2 text-xs" style={{ background: `${LEVEL_COLOR[w.level]}18`, borderLeft: `3px solid ${LEVEL_COLOR[w.level]}` }}>
                      <div className="font-semibold" style={{ color: LEVEL_COLOR[w.level] }}>{w.headline}</div>
                      <div className="text-[var(--muted)] mt-0.5">{w.instruction}</div>
                    </div>
                  ))}
                </div>
              )
            })()}
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
          </span>
        ))}
        {updatedAt && <span className="text-[9px] text-[var(--muted)] border-l border-white/10 pl-3">{t.updated} {new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
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
