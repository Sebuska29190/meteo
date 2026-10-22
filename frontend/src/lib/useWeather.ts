import { useEffect, useState } from 'react'

export interface WeatherData {
  current: { temp: number; wind: number; gusts: number; precip: number; code: number; humidity: number; pressure: number }
  hourly: { time: string[]; temp: number[]; precip: number[]; wind: number[] }
}

export function useWeather(lat: number | null, lon: number | null) {
  const [data, setData] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (lat == null || lon == null) { setData(null); return }
    let cancelled = false
    setLoading(true)
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation,wind_speed_10m,wind_gusts_10m,weather_code,relative_humidity_2m,surface_pressure&hourly=temperature_2m,precipitation,wind_speed_10m,precipitation_probability&forecast_hours=24`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        setData({
          current: {
            temp: j.current?.temperature_2m, wind: j.current?.wind_speed_10m,
            gusts: j.current?.wind_gusts_10m, precip: j.current?.precipitation, code: j.current?.weather_code,
            humidity: j.current?.relative_humidity_2m, pressure: j.current?.surface_pressure,
          },
          hourly: {
            time: j.hourly?.time || [], temp: j.hourly?.temperature_2m || [],
            precip: j.hourly?.precipitation || [], wind: j.hourly?.wind_speed_10m || [],
            pop: j.hourly?.precipitation_probability || [],
          },
        } as any)
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [lat, lon])

  return { data, loading }
}
