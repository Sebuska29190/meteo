import { createContext, useContext, useState, type ReactNode } from 'react'

export type Lang = 'fr' | 'en'

const dict = {
  fr: {
    title: 'Météo France - Alertes en direct',
    subtitle: 'Vigilance météo en temps réel',
    nav_map: 'Carte',
    nav_alerts: 'Alertes',
    loading: 'Chargement...',
    no_alerts: 'Aucune alerte active',
    level: 'Niveau',
    department: 'Département',
    phenomenon: 'Phénomène',
    updated: 'Mis à jour',
    green: 'Vert',
    yellow: 'Jaune',
    orange: 'Orange',
    red: 'Rouge',
    wind: 'Vent',
    rain: 'Pluie',
    storm: 'Orage',
    heat: 'Canicule',
    cold: 'Grand froid',
    snow_ice: 'Neige-verglas',
    flood: 'Crue-inondation',
    waves: 'Vagues-submersion',
    avalanche: 'Avalanche',
  },
  en: {
    title: 'Météo France - Live Alerts',
    subtitle: 'Real-time weather vigilance',
    nav_map: 'Map',
    nav_alerts: 'Alerts',
    loading: 'Loading...',
    no_alerts: 'No active alerts',
    level: 'Level',
    department: 'Department',
    phenomenon: 'Phenomenon',
    updated: 'Updated',
    green: 'Green',
    yellow: 'Yellow',
    orange: 'Orange',
    red: 'Red',
    wind: 'Wind',
    rain: 'Rain',
    storm: 'Storm',
    heat: 'Heatwave',
    cold: 'Extreme cold',
    snow_ice: 'Snow-ice',
    flood: 'Flood',
    waves: 'Waves-submersion',
    avalanche: 'Avalanche',
  },
} as const

type Dict = (typeof dict)[Lang]

interface Ctx {
  lang: Lang
  setLang: (l: Lang) => void
  t: Dict
}

const I18nCtx = createContext<Ctx | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem('lang')
    if (saved === 'fr' || saved === 'en') return saved
    return navigator.language.startsWith('fr') ? 'fr' : 'en'
  })
  const set = (l: Lang) => {
    setLang(l)
    localStorage.setItem('lang', l)
  }
  return (
    <I18nCtx.Provider value={{ lang, setLang: set, t: dict[lang] as Dict }}>
      {children}
    </I18nCtx.Provider>
  )
}

export function useI18n() {
  const c = useContext(I18nCtx)
  if (!c) throw new Error('I18nProvider missing')
  return c
}