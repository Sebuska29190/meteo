import { Link } from 'react-router-dom'
import { Map as MapIcon, Radar, Wind, Zap, ArrowRight, ShieldCheck } from 'lucide-react'
import { useI18n } from '../contexts/I18nContext'
import { useVigilance } from '../lib/useVigilance'

export default function LandingPage() {
  const { t, lang, setLang } = useI18n()
  const { warnings } = useVigilance()
  const active = warnings.filter((w) => w.level >= 2).length

  const feats = [
    { icon: ShieldCheck, title: t.feat1_t, desc: t.feat1_d },
    { icon: Radar, title: t.feat2_t, desc: t.feat2_d },
    { icon: Wind, title: t.feat3_t, desc: t.feat3_d },
    { icon: Zap, title: t.feat4_t, desc: t.feat4_d },
  ]

  return (
    <div className="min-h-screen bg-[var(--bg)] overflow-auto">
      {/* NAV */}
      <div className="sticky top-0 z-50 glass">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">
          <span className="text-xl font-extrabold tracking-tight"><span className="text-[var(--accent)]">Météo</span>Live</span>
          <div className="flex items-center gap-3">
            {active > 0 && (
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-[var(--red)]/15 text-[var(--red)] pulse-dot">
                {active} {t.warnings_count}
              </span>
            )}
            <button onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')} className="text-xs font-semibold text-[var(--muted)] hover:text-white px-2">{lang === 'fr' ? 'EN' : 'FR'}</button>
            <Link to="/app" className="text-xs font-semibold px-4 py-2 rounded-lg bg-[var(--accent)] text-white hover:opacity-90">{t.cta_open}</Link>
          </div>
        </div>
      </div>

      {/* HERO */}
      <div className="max-w-6xl mx-auto px-5 pt-20 pb-16 text-center fade-in">
        <div className="inline-flex items-center gap-2 text-[11px] font-bold text-[var(--ok)] px-3 py-1.5 rounded-full border border-[var(--ok)]/30 mb-6">
          <span className="w-2 h-2 rounded-full bg-[var(--ok)] pulse-dot" />{t.live}
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold display leading-[1.08] max-w-3xl mx-auto">{t.hero_title}</h1>
        <p className="text-[var(--muted)] mt-5 max-w-2xl mx-auto text-base leading-relaxed">{t.hero_sub}</p>
        <div className="flex items-center justify-center gap-3 mt-8 flex-wrap">
          <Link to="/app" className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm hover:opacity-90 transition">
            <MapIcon size={17} />{t.cta_open}
          </Link>
          <Link to="/app/alerts" className="flex items-center gap-2 px-6 py-3.5 rounded-xl glass font-semibold text-sm hover:bg-white/10 transition">
            {t.cta_alerts}{active > 0 && <span className="text-[var(--red)] font-bold">{active}</span>}
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      {/* FEATURES */}
      <div className="max-w-6xl mx-auto px-5 pb-16 grid md:grid-cols-4 gap-4">
        {feats.map((f, i) => (
          <div key={i} className="glass rounded-2xl p-5 fade-in" style={{ animationDelay: `${i * 0.08}s` }}>
            <f.icon size={22} className="text-[var(--accent)] mb-3" />
            <div className="font-bold mb-1.5">{f.title}</div>
            <div className="text-xs text-[var(--muted)] leading-relaxed">{f.desc}</div>
          </div>
        ))}
      </div>

      {/* Screenshot-ish map strip */}
      <div className="max-w-6xl mx-auto px-5 pb-20">
        <div className="glass rounded-3xl overflow-hidden">
          <div className="h-8 bg-white/5 flex items-center gap-1.5 px-4">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
          </div>
          <div className="relative h-[300px] md:h-[460px]">
            <iframe src="/app?embed=1" title="MétéoLive live map" className="w-full h-full border-0" loading="lazy" />
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="border-t border-white/5 py-8 text-center">
        <p className="text-[10px] text-[var(--muted)] max-w-2xl mx-auto px-5">{t.open_data}</p>
        <p className="text-[10px] text-[var(--muted)] mt-2">© 2026 MétéoLive · <Link className="underline" to="/app/alerts">{t.nav_alerts}</Link></p>
      </div>
    </div>
  )
}
