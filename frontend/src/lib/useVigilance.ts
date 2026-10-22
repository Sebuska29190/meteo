import { useEffect, useState } from 'react'

export type VigilanceLevel = 1 | 2 | 3 | 4

export interface Warning {
  id: string
  event: string
  headline: string
  description: string
  instruction: string
  severity: string
  level: VigilanceLevel
  type: string
  onset: string
  expires: string
  sent: string
  areas: string[]
  lang: string
}

const DEPT_CODE: Record<string, string> = {
  'Ain': '01', 'Aisne': '02', 'Allier': '03', 'Alpes-de-Haute-Provence': '04',
  'Hautes-Alpes': '05', 'Alpes-Maritimes': '06', 'Ardèche': '07', 'Ardennes': '08',
  'Ariège': '09', 'Aube': '10', 'Aude': '11', 'Aveyron': '12', 'Bouches-du-Rhône': '13',
  'Calvados': '14', 'Cantal': '15', 'Charente': '16', 'Charente-Maritime': '17',
  'Cher': '18', 'Corrèze': '19', "Côte-d'Or": '21', "Côtes-d'Armor": '22',
  'Creuse': '23', 'Dordogne': '24', 'Doubs': '25', 'Drôme': '26', 'Eure': '27',
  'Eure-et-Loir': '28', 'Finistère': '29', 'Corse-du-Sud': '2A', 'Haute-Corse': '2B',
  'Gard': '30', 'Haute-Garonne': '31', 'Gers': '32', 'Gironde': '33', 'Hérault': '34',
  'Ille-et-Vilaine': '35', 'Indre': '36', 'Indre-et-Loire': '37', 'Isère': '38',
  'Jura': '39', 'Landes': '40', 'Loir-et-Cher': '41', 'Loire': '42',
  'Haute-Loire': '43', 'Loire-Atlantique': '44', 'Loiret': '45', 'Lot': '46',
  'Lot-et-Garonne': '47', 'Lozère': '48', 'Maine-et-Loire': '49', 'Manche': '50',
  'Marne': '51', 'Haute-Marne': '52', 'Mayenne': '53', 'Meurthe-et-Moselle': '54',
  'Meuse': '55', 'Morbihan': '56', 'Moselle': '57', 'Nièvre': '58', 'Nord': '59',
  'Oise': '60', 'Orne': '61', 'Pas-de-Calais': '62', 'Puy-de-Dôme': '63',
  'Pyrénées-Atlantiques': '64', 'Hautes-Pyrénées': '65', 'Pyrénées-Orientales': '66',
  'Bas-Rhin': '67', 'Haut-Rhin': '68', 'Rhône': '69', 'Haute-Saône': '70',
  'Saône-et-Loire': '71', 'Sarthe': '72', 'Savoie': '73', 'Haute-Savoie': '74',
  'Paris': '75', 'Seine-Maritime': '76', 'Seine-et-Marne': '77', 'Yvelines': '78',
  'Deux-Sèvres': '79', 'Somme': '80', 'Tarn': '81', 'Tarn-et-Garonne': '82',
  'Var': '83', 'Vaucluse': '84', 'Vendée': '85', 'Vienne': '86',
  'Haute-Vienne': '87', 'Vosges': '88', 'Yonne': '89', 'Territoire de Belfort': '90',
  'Essonne': '91', 'Hauts-de-Seine': '92', 'Seine-Saint-Denis': '93',
  'Val-de-Marne': '94', "Val-d'Oise": '95',
}

const LEVEL_FROM_PARAM = (p: any): VigilanceLevel => {
  const v = (p?.value || '').toString().toLowerCase()
  if (v.includes('red') || v.includes('rouge') || v.startsWith('4')) return 4
  if (v.includes('orange') || v.startsWith('3')) return 3
  if (v.includes('yellow') || v.includes('jaune') || v.startsWith('2')) return 2
  return 1
}

const API_BASE = import.meta.env.VITE_API_BASE || ''

export function useVigilance() {
  const [warnings, setWarnings] = useState<Warning[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const r = await fetch(`${API_BASE}/api/vigilance`)
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const json = await r.json()
        if (cancelled) return
        const list: Warning[] = (json?.warnings || []).map((w: any) => {
          const infos = w?.alert?.info || []
          const fr = infos.find((i: any) => (i.language || '').startsWith('fr')) || infos[0] || {}
          const paramLevel = (fr.parameter || []).find((p: any) => p.valueName === 'awareness_level')
          const paramType = (fr.parameter || []).find((p: any) => p.valueName === 'awareness_type')
          const areas = (fr.area || []).map((a: any) => a.areaDesc).filter(Boolean)
          return {
            id: w?.alert?.identifier || w?.uuid,
            event: fr.event || '', headline: fr.headline || '',
            description: fr.description || '', instruction: fr.instruction || '',
            severity: fr.severity || '',
            level: LEVEL_FROM_PARAM(paramLevel),
            type: paramType?.value || '',
            onset: fr.onset || '', expires: fr.expires || '',
            sent: w?.alert?.sent || '',
            areas, lang: fr.language || 'fr-FR',
          }
        })
        setWarnings(list)
        setUpdatedAt(new Date().toISOString())
        setError(null)
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    const iv = setInterval(load, 2 * 60 * 1000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [])

  const deptColors: Record<string, VigilanceLevel> = {}
  const lastSent = warnings.reduce((acc, w) => (!acc || (w.sent && w.sent > acc) ? w.sent : acc), '')

  warnings.forEach((w) => {
    w.areas.forEach((name) => {
      const code = DEPT_CODE[name]
      if (code) {
        const cur = deptColors[code] || 1
        if (w.level > cur) deptColors[code] = w.level
      }
    })
  })

  return { warnings, loading, error, updatedAt, deptColors, lastSent }
}
