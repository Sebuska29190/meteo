import { Outlet, NavLink } from 'react-router-dom'
import { useI18n } from '../contexts/I18nContext'

export default function Layout() {
  const { t, lang, setLang } = useI18n()
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-[var(--accent)]">MétéoLive</span>
            <span className="text-sm text-[var(--text-muted)] hidden sm:inline">{t.subtitle}</span>
          </div>
          <nav className="flex items-center gap-4">
            <NavLink to="/" className={({ isActive }) => `text-sm ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>{t.nav_map}</NavLink>
            <NavLink to="/alerts" className={({ isActive }) => `text-sm ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>{t.nav_alerts}</NavLink>
            <button
              onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
              className="text-xs px-2 py-1 rounded border border-[var(--border)] hover:border-[var(--accent)]"
            >
              {lang === 'fr' ? 'EN' : 'FR'}
            </button>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}