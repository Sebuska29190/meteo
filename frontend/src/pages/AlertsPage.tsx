import { Link } from 'react-router-dom'
import { ArrowLeft, TriangleAlert } from 'lucide-react'
import { useI18n } from '../contexts/I18nContext'
import { useVigilance, type VigilanceLevel } from '../lib/useVigilance'

const LEVEL_COLOR: Record<VigilanceLevel, string> = { 1: '#35d08c', 2: '#ffd23f', 3: '#ff7a1a', 4: '#ff2d55' }

export default function AlertsPage() {
  const { t, lang, setLang } = useI18n()
  const { warnings, loading, error, updatedAt } = useVigilance()
  const levelName = (l: VigilanceLevel) => l === 1 ? t.green : l === 2 ? t.yellow : l === 3 ? t.orange : t.red
  const seen = new Set<string>()
  const sorted = warnings.filter((w) => w.level >= 2).sort((a, b) => b.level - a.level)

  return (
    <div className="min-h-screen bg-[var(--bg)] overflow-auto">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-white">
            <ArrowLeft size={16} /> {t.nav_map}
          </Link>
          <button onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')} className="text-xs font-semibold px-3 py-1.5 rounded-lg glass text-[var(--muted)] hover:text-white">
            {lang === 'fr' ? 'EN' : 'FR'}
          </button>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <TriangleAlert size={28} className="text-[var(--accent)]" />
          <div>
            <h1 className="text-3xl font-extrabold display">{t.nav_alerts}</h1>
            <p className="text-xs text-[var(--muted)]">{t.subtitle} · {updatedAt ? `${t.updated} ${new Date(updatedAt).toLocaleTimeString()}` : ''}</p>
          </div>
        </div>

        {loading && <div className="glass rounded-2xl p-6 text-sm text-[var(--muted)]">{t.loading}</div>}
        {error && <div className="glass rounded-2xl p-6 text-sm text-[var(--red)]">{error}</div>}
        {!loading && sorted.length === 0 && (
          <div className="glass rounded-2xl p-8 text-center">
            <div className="text-4xl mb-2">✅</div>
            <div className="text-sm text-[var(--muted)]">{t.no_alerts}</div>
          </div>
        )}

        <div className="grid gap-3">
          {sorted.map((w) => {
            const k = w.id + w.areas.join()
            if (seen.has(k)) return null
            seen.add(k)
            return (
              <div key={k} className="glass rounded-2xl p-5 fade-in" style={{ borderLeft: `4px solid ${LEVEL_COLOR[w.level]}` }}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full pulse-dot" style={{ background: LEVEL_COLOR[w.level] }} />
                    <h2 className="font-bold">{w.headline}</h2>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-md" style={{ background: `${LEVEL_COLOR[w.level]}1f`, color: LEVEL_COLOR[w.level] }}>
                    {levelName(w.level)}
                  </span>
                </div>
                <p className="text-sm text-[var(--muted)] mt-2.5 leading-relaxed">{w.description}</p>
                {w.instruction && (
                  <p className="text-xs mt-3 p-3 rounded-lg bg-white/5 border border-white/5 text-[var(--text)]">
                    <strong className="text-[var(--accent-2)]">⚠ </strong>{w.instruction}
                  </p>
                )}
                <div className="mt-3 text-xs text-[var(--muted)]">
                  <span className="font-semibold text-[var(--text)]">{t.department}: </span>{w.areas.join(' · ')}
                </div>
                <div className="mt-2 text-[10px] text-[var(--muted)] font-mono">{w.onset?.replace('T', ' ').slice(0, 16)} → {w.expires?.replace('T', ' ').slice(0, 16)}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
