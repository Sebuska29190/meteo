import { useI18n } from '../contexts/I18nContext'
import { useVigilance, type VigilanceLevel } from '../lib/useVigilance'

const LEVEL_COLOR: Record<VigilanceLevel, string> = { 1: '#2d6a4f', 2: '#ffd23f', 3: '#ff6b35', 4: '#ff3b5c' }

export default function AlertsPage() {
  const { t } = useI18n()
  const { warnings, loading, error, updatedAt } = useVigilance()

  const levelName = (l: VigilanceLevel) => l === 1 ? t.green : l === 2 ? t.yellow : l === 3 ? t.orange : t.red

  // dedup by event+level keeping highest
  const sorted = [...warnings].sort((a, b) => b.level - a.level)

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{t.nav_alerts}</h1>
        {updatedAt && <span className="text-xs text-[var(--text-muted)]">{t.updated}: {new Date(updatedAt).toLocaleTimeString()}</span>}
      </div>
      {loading && <p className="text-[var(--text-muted)]">{t.loading}</p>}
      {error && <p className="text-[var(--danger)]">{error}</p>}
      {!loading && sorted.length === 0 && <p className="text-[var(--text-muted)]">{t.no_alerts}</p>}
      <div className="grid gap-3">
        {sorted.map((w) => (
          <div key={w.id} className="p-4 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full" style={{ background: LEVEL_COLOR[w.level] }} />
                <span className="font-semibold">{w.headline}</span>
              </div>
              <span className="text-xs text-[var(--text-muted)]">{levelName(w.level)}</span>
            </div>
            <p className="text-sm text-[var(--text-muted)] mb-2">{w.description}</p>
            {w.areas.length > 0 && (
              <p className="text-xs text-[var(--text-muted)] mb-1">
                <strong>{t.department}:</strong> {w.areas.join(', ')}
              </p>
            )}
            {w.instruction && <p className="text-xs text-[var(--text)] mt-2 italic">{w.instruction}</p>}
            <p className="text-[10px] text-[var(--text-muted)] mt-2">{w.onset} → {w.expires}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
