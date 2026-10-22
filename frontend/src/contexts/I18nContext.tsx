import { createContext, useContext, useState, type ReactNode } from 'react'

export type Lang = 'fr' | 'en'

const dict = {
  fr: {
    title: 'MétéoLive',
    subtitle: 'Vigilance météo France en direct',
    nav_map: 'Carte',
    nav_alerts: 'Alertes',
    loading: 'Chargement...',
    no_alerts: 'Aucune alerte active. Situation calme.',
    level: 'Niveau',
    department: 'Départements',
    phenomenon: 'Phénomène',
    updated: 'Actualisé',
    green: 'Vert', yellow: 'Jaune', orange: 'Orange', red: 'Rouge',
    radar: 'Radar',
    search_ph: 'Rechercher une ville, un département...',
    active_alerts: 'Alertes actives',
    watch_d: 'Soyez attentif', orange_d: 'Soyez très vigilant', red_d: 'Danger absolu',
    current: 'Actuellement',
    forecast: 'Prévisions 24h',
    temp: 'Temp.', wind: 'Vent', gusts: 'Rafales', precip: 'Pluie',
    next_hours: 'Prochaines heures',
    click_dept: 'Cliquez sur un département pour les détails',
    live: 'EN DIRECT',
    warnings_count: 'alerte(s) en cours',
  },
  en: {
    title: 'MétéoLive',
    subtitle: 'France weather vigilance live',
    nav_map: 'Map',
    nav_alerts: 'Alerts',
    loading: 'Loading...',
    no_alerts: 'No active alerts. Situation calm.',
    level: 'Level',
    department: 'Departments',
    phenomenon: 'Phenomenon',
    updated: 'Updated',
    green: 'Green', yellow: 'Yellow', orange: 'Orange', red: 'Red',
    radar: 'Radar',
    search_ph: 'Search a city, a department...',
    active_alerts: 'Active alerts',
    watch_d: 'Be careful', orange_d: 'Be very vigilant', red_d: 'Absolute danger',
    current: 'Current',
    forecast: '24h forecast',
    temp: 'Temp.', wind: 'Wind', gusts: 'Gusts', precip: 'Rain',
    next_hours: 'Next hours',
    click_dept: 'Click a department for details',
    live: 'LIVE',
    warnings_count: 'active alert(s)',
  },
} as const

type Dict = (typeof dict)[Lang]

interface Ctx { lang: Lang; setLang: (l: Lang) => void; t: Dict }
const I18nCtx = createContext<Ctx | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem('lang')
    if (saved === 'fr' || saved === 'en') return saved
    return navigator.language.startsWith('fr') ? 'fr' : 'en'
  })
  const set = (l: Lang) => { setLang(l); localStorage.setItem('lang', l) }
  return <I18nCtx.Provider value={{ lang, setLang: set, t: dict[lang] as Dict }}>{children}</I18nCtx.Provider>
}

export function useI18n() {
  const c = useContext(I18nCtx)
  if (!c) throw new Error('I18nProvider missing')
  return c
}
