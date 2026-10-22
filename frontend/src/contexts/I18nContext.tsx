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
    tomorrow: 'Demain (J+1)',
    floods: 'Crues',
    bolts: 'Éclairs',
    watch: 'Observer',
    watching: 'Observés',
    trend: 'Tendance 24h',
    river_level: 'Niveau d\'eau',
    storms_live: 'Éclairs en direct',
    // landing
    hero_title: 'La météo qui vous alerte avant tout le monde',
    hero_sub: 'Vigilance Météo-France en direct, radar des pluies, vent animé, crues des rivières et éclairs en temps réel. Tout, sur une seule carte.',
    cta_open: 'Ouvrir la carte live',
    cta_alerts: 'Alertes actives',
    feat1_t: 'Vigilance officielle', feat1_d: 'Les alertes Météo-France via Meteoalarm, sans délai, département par département.',
    feat2_t: 'Radar des pluies', feat2_d: 'Animation des 60 dernières minutes, image par image.',
    feat3_t: 'Vent animé', feat3_d: 'Flux animé basé sur les mesures réelles de vitesse et direction.',
    feat4_t: 'Crues & éclairs', feat4_d: 'Niveaux des rivières (Hub\'Eau) et foudre en direct (Blitzortung).',
    open_data: '100% données ouvertes : Météo-France / Meteoalarm, Open-Meteo, RainViewer, Hub\'Eau, Blitzortung',
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
    tomorrow: 'Tomorrow (D+1)',
    floods: 'Floods',
    bolts: 'Lightning',
    watch: 'Watch',
    watching: 'Watched',
    trend: '24h trend',
    river_level: 'Water level',
    storms_live: 'Live lightning',
    // landing
    hero_title: 'The weather that alerts you before everyone else',
    hero_sub: 'Live Météo-France vigilance, rain radar, animated wind, river floods and real-time lightning. Everything on a single map.',
    cta_open: 'Open the live map',
    cta_alerts: 'Active alerts',
    feat1_t: 'Official vigilance', feat1_d: 'Météo-France alerts via Meteoalarm, without delay, department by department.',
    feat2_t: 'Rain radar', feat2_d: 'Animation of the last 60 minutes, frame by frame.',
    feat3_t: 'Animated wind', feat3_d: 'Animated flow based on real speed and direction measurements.',
    feat4_t: 'Floods & lightning', feat4_d: 'River levels (Hub\'Eau) and live lightning (Blitzortung).',
    open_data: '100% open data: Météo-France / Meteoalarm, Open-Meteo, RainViewer, Hub\'Eau, Blitzortung',
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
