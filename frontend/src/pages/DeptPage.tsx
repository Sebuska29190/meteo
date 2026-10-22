import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Star } from 'lucide-react'
import { useI18n } from '../contexts/I18nContext'
import { useVigilance, type VigilanceLevel } from '../lib/useVigilance'
import { useWeather } from '../lib/useWeather'
import { GEOJSON_URL_FALLBACK } from '../lib/geo'

const LEVEL_COLOR: Record<VigilanceLevel, string> = { 1: '#35d08c', 2: '#ffd23f', 3: '#ff7a1a', 4: '#ff2d55' }
const WMO: Record<number, string> = { 0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 51: '🌦️', 61: '🌧️', 71: '🌨️', 80: '🌦️', 95: '⛈️' }

export default function DeptPage() {
  const { code = '' } = useParams()
  const { t, lang } = useI18n()
  const { warnings, deptColors, updatedAt } = useVigilance()
  const [meta, setMeta] = useState<{ name: string; lat: number; lon: number } | null>(null)
  const { data: weather, loading } = useWeather(meta?.lat ?? null, meta?.lon ?? null)
  const [watched, setWatched] = useState<string[]>(() => JSON.parse(localStorage.getItem('watched') || '[]'))

  useEffect(() => {
    fetch(GEOJSON_URL_FALLBACK).then((r) => r.json()).then((geo) => {
      const f = geo.features.find((x: any) => String(x.properties?.code) === code)
      if (!f) return
      const ring = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates[0][0] : f.geometry.coordinates[0]
      const lons = ring.map((p: any) => p[0]); const lats = ring.map((p: any) => p[1])
      setMeta({ name: f.properties?.name || code, lat: (Math.min(...lats) + Math.max(...lats)) / 2, lon: (Math.min(...lons) + Math.max(...lons)) / 2 })
    }).catch(() => {})
  }, [code])

  const level = (deptColors[code] || 1) as VigilanceLevel
  const deptWarnings = warnings.filter((w) => w.areas.includes(meta?.name || '§'))
  const isWatched = watched.includes(meta?.name || '')

  const toggleWatch = () => {
    if (!meta) return
    setWatched((w) => {
      const next = w.includes(meta.name) ? w.filter((x) => x !== meta.name) : [...w, meta.name]
      localStorage.setItem('watched', JSON.stringify(next))
      return next
    })
  }

  const pheno = (ev: string) => {
    const e = ev.toLowerCase()
    if (e.includes('orage')) return t.storm
    if (e.includes('pluie')) return t.rain_flood
    if (e.includes('inond')) return t.flood_r
    if (e.includes('vent')) return t.wind_v
    if (e.includes('neige') || e.includes('verglas')) return t.snow
    if (e.includes('vague')) return t.waves_s
    if (e.includes('froid')) return t.cold_e
    if (e.includes('canicule')) return t.heat_w
    return ev
  }

  const next48 = useMemo(() => {
    if (!weather) return []
    return weather.hourly.time.slice(0, 48).map((tm, i) => ({ tm, temp: weather.hourly.temp[i], pop: (weather.hourly as any).pop?.[i], precip: weather.hourly.precip[i] }))
  }, [weather])

  return (
    <div className="min-h-screen bg-[var(--bg)] overflow-auto">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link to="/app" className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-white mb-6">
          <ArrowLeft size={16} /> {t.nav_map}
        </Link>

        {!meta && <div className="skel h-24 w-full mb-4" />}
        {meta && (
          <>
            <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-[var(--muted)]">{t.department}</div>
                <h1 className="text-3xl font-extrabold display">{meta.name} <span className="text-[var(--muted)] text-lg tnum">{code}</span></h1>
                <div className="mt-2 flex items-center gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: LEVEL_COLOR[level] }}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: LEVEL_COLOR[level] }} />
                    {level === 1 ? t.watch_d : level === 2 ? t.watch_d : level === 3 ? t.orange_d : t.red_d}
                  </span>
                  <button onClick={toggleWatch} className={`text-[11px] font-semibold flex items-center gap-1 px-2.5 py-1 rounded-full border ${isWatched ? 'border-[var(--warn)] text-[var(--warn)]' : 'border-[var(--border)] text-[var(--muted)]'}`}>
                    <Star size={11} fill={isWatched ? 'currentColor' : 'none'} />{isWatched ? t.watching : t.watch}
                  </button>
                </div>
              </div>
              {updatedAt && <span className="text-[10px] text-[var(--muted)] tnum">{t.updated} {new Date(updatedAt).toLocaleTimeString()}</span>}
            </div>

            {loading && <div className="skel h-20 w-full mb-4" />}
            {weather && (
              <div className="glass rounded-2xl p-5 mb-4">
                <div className="flex items-baseline gap-3">
                  <span className="text-5xl font-extrabold display tnum">{Math.round(weather.current.temp)}°</span>
                  <span className="text-3xl">{WMO[weather.current.code] || '🌡️'}</span>
                  <span className="ml-auto text-xs text-[var(--muted)] text-right tnum">
                    💧{weather.current.humidity}% · {Math.round(weather.current.pressure)} hPa<br />
                    {t.wind} {Math.round(weather.current.wind)} · {t.gusts} {Math.round(weather.current.gusts)} km/h
                  </span>
                </div>
                <div className="mt-4">
                  <div className="text-[10px] uppercase tracking-widest text-[var(--muted)] mb-2">48h</div>
                  <div className="grid grid-cols-8 sm:grid-cols-12 gap-1">
                    {next48.filter((_, i) => i % 3 === 0).map((h, i) => (
                      <div key={i} className="bg-white/5 rounded-lg px-1 py-1.5 text-center">
                        <div className="text-[8px] text-[var(--muted)] tnum">{h.tm.slice(5, 10).replace('-', '/')} {h.tm.slice(11, 13)}h</div>
                        <div className="text-xs font-bold tnum">{Math.round(h.temp)}°</div>
                        <div className="text-[8px] text-[#4aa3ff] tnum">{h.pop != null ? `${h.pop}%` : '·'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--muted)] mb-2">{t.active_alerts}</h2>
            {deptWarnings.length === 0 && <div className="glass rounded-2xl p-6 text-center text-sm text-[var(--muted)]">✅ {t.no_alerts}</div>}
            <div className="grid gap-3">
              {deptWarnings.map((w) => (
                <div key={w.id} className="glass rounded-2xl p-4" style={{ borderLeft: `4px solid ${LEVEL_COLOR[w.level]}` }}>
                  <div className="flex justify-between items-center gap-2 flex-wrap">
                    <span className="font-bold" style={{ color: LEVEL_COLOR[w.level] }}>{pheno(w.event)}</span>
                    <span className="text-[10px] text-[var(--muted)] font-mono tnum">{w.onset?.slice(5, 16).replace('T', ' ')} → {w.expires?.slice(5, 16).replace('T', ' ')}</span>
                  </div>
                  {w.description && <p className="text-xs text-[var(--muted)] mt-2">{w.description}</p>}
                  {w.instruction && <p className="text-xs mt-2 p-2.5 rounded-lg bg-white/5 border border-white/5">⚠ {w.instruction}</p>}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-[var(--muted)] mt-6">{lang === 'fr' ? 'Source : Météo-France via Meteoalarm · Open-Meteo' : 'Source: Météo-France via Meteoalarm · Open-Meteo'}</p>
          </>
        )}
      </div>
    </div>
  )
}
