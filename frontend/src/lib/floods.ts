
export interface FloodStation { code: string; name: string; lat: number; lon: number; h: number | null; date: string }

export async function fetchFloodStations(bbox: string): Promise<FloodStation[]> {
  const UA = { headers: { Accept: 'application/json' } }
  const ref = await fetch(`https://hubeau.eaufrance.fr/api/v2/hydrometrie/referentiel/stations?bbox=${bbox}&size=100&fields=code_station,libelle_station,longitude_station,latitude_station`, UA)
  const refJson = await ref.json()
  const stations: any[] = refJson?.data || []
  if (!stations.length) return []
  const obs = await fetch(`https://hubeau.eaufrance.fr/api/v2/hydrometrie/observations_tr?bbox=${bbox}&size=200&grandeur_hydro=H&sort=desc&fields=date_obs,resultat_obs,code_station`, UA)
  const obsJson = await obs.json()
  const latest = new Map<string, { h: number; date: string }>()
  for (const o of obsJson?.data || []) {
    if (!latest.has(o.code_station)) latest.set(o.code_station, { h: o.resultat_obs, date: o.date_obs })
  }
  return stations
    .map((s) => ({
      code: s.code_station,
      name: s.libelle_station || s.code_station,
      lat: s.latitude_station,
      lon: s.longitude_station,
      h: latest.get(s.code_station)?.h ?? null,
      date: latest.get(s.code_station)?.date ?? '',
    }))
    .filter((s) => s.lat && s.lon)
    .map((s) => ({ ...s, h: s.h != null ? s.h / 1000 : null })) // mm -> m
}
