import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useI18n } from '../contexts/I18nContext'
import { useVigilance, type VigilanceLevel } from '../lib/useVigilance'
import { useRadarTimestamp } from '../lib/useRadar'

const GEOJSON_URL = 'https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements.geojson'

const LEVEL_COLOR: Record<VigilanceLevel, string> = {
  1: '#2d6a4f', 2: '#ffd23f', 3: '#ff6b35', 4: '#ff3b5c',
}

export default function MapPage() {
  const { t } = useI18n()
  const { loading, error, deptColors, updatedAt } = useVigilance()
  const radarTs = useRadarTimestamp()
  const [geo, setGeo] = useState<any>(null)
  const [geoLoading, setGeoLoading] = useState(true)
  const [radarOn, setRadarOn] = useState(false)

  useEffect(() => {
    fetch(GEOJSON_URL).then((r) => r.json()).then((d) => { setGeo(d); setGeoLoading(false) }).catch(() => setGeoLoading(false))
  }, [])

  const styleFn = (feature: any) => {
    const code = feature?.properties?.code || feature?.properties?.numero || feature?.properties?.dep
    const lvl = (deptColors[String(code)] || 1) as VigilanceLevel
    return { color: '#1f2a40', weight: 1, fillColor: LEVEL_COLOR[lvl], fillOpacity: lvl === 1 ? 0.25 : 0.55 }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRadarOn((v) => !v)}
            className={`text-xs px-3 py-1.5 rounded border ${radarOn ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}
          >
            Radar {radarOn ? 'ON' : 'OFF'}
          </button>
          {updatedAt && <span className="text-xs text-[var(--text-muted)]">{t.updated}: {new Date(updatedAt).toLocaleTimeString()}</span>}
        </div>
      </div>
      {(loading || geoLoading) && <p className="text-[var(--text-muted)] mb-2">{t.loading}</p>}
      {error && <p className="text-[var(--danger)] mb-2">{error}</p>}
      <div className="h-[70vh] rounded-lg overflow-hidden border border-[var(--border)]">
        <MapContainer center={[46.6, 2.5]} zoom={6} style={{ height: '100%', width: '100%' }}>
          <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {geo && <GeoJSON data={geo} style={styleFn as any} />}
          {radarOn && radarTs && (
            <TileLayer
              url={`https://tile.rainviewer.com/v2/radar/${radarTs}/256/{z}/{x}/{y}/2/1_1.png`}
              opacity={0.6}
            />
          )}
        </MapContainer>
      </div>
      <div className="mt-3 flex gap-3 text-xs flex-wrap">
        {([1, 2, 3, 4] as VigilanceLevel[]).map((l) => (
          <span key={l} className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded" style={{ background: LEVEL_COLOR[l] }} />
            {l === 1 ? t.green : l === 2 ? t.yellow : l === 3 ? t.orange : t.red}
          </span>
        ))}
      </div>
    </div>
  )
}
