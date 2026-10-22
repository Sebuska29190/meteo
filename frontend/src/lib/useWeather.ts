import { useEffect, useState } from 'react'

export interface WeatherData {
  current: { temp: number; wind: number; gusts: number; precip: number; code: number }
  hourly: { time: string[]; temp: number[]; precip: number[]; wind: number[] }
}

export function useWeather(lat: number | null, lon: number | null) {
  const [data, setData] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (lat == null || lon == null) { setData(null); return }
    let cancelled = false
    setLoading(true)
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation,wind_speed_10m,wind_gusts_10m,weather_code&hourly=temperature_2m,precipitation,wind_speed_10m&forecast_hours=24`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        setData({
          current: {
            temp: j.current?.temperature_2m, wind: j.current?.wind_speed_10m,
            gusts: j.current?.wind_gusts_10m, precip: j.current?.precipitation, code: j.current?.weather_code,
          },
          hourly: { time: j.hourly?.time || [], temp: j.hourly?.temperature_2m || [], precip: j.hourly?.precipitation || [], wind: j.hourly?.wind_speed_10m || [] },
        })
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [lat, lon])

  return { data, loading }
}
