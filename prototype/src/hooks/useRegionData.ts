import { useEffect, useMemo, useState } from 'react'
import type { GeoData, RegionStats } from '../types'
import { generateStats } from '../data/generateStats'

export type Level = 'region' | 'district'

export interface RegionData {
  regions: GeoData | null
  districts: GeoData | null
  mfy: GeoData | null // mahalla (MFY) zonalari
  statsById: Record<string, RegionStats> // "region:<id>" yoki "district:<id>"
  loading: boolean
  error: string | null
  national: {
    totalTrees: number
    avgGreenery: number
    districts: number
  }
}

function statsForLevel(
  geo: GeoData | null,
  level: Level,
  out: Record<string, RegionStats>
) {
  if (!geo) return
  for (const f of geo.features) {
    const key = `${level}:${f.id}`
    out[key] = generateStats(key, f.properties.name)
  }
}

export function useRegionData(): RegionData {
  const [regions, setRegions] = useState<GeoData | null>(null)
  const [districts, setDistricts] = useState<GeoData | null>(null)
  const [mfy, setMfy] = useState<GeoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const base = import.meta.env.BASE_URL
    Promise.all([
      fetch(`${base}data/regions.geojson`).then((r) => {
        if (!r.ok) throw new Error(`regions.geojson: ${r.status}`)
        return r.json()
      }),
      fetch(`${base}data/uzbekistan.geojson`).then((r) => {
        if (!r.ok) throw new Error(`uzbekistan.geojson: ${r.status}`)
        return r.json()
      }),
    ])
      .then(([reg, dist]: [GeoData, GeoData]) => {
        setRegions(reg)
        setDistricts(dist)
      })
      .catch((e) => setError(String(e.message ?? e)))
      .finally(() => setLoading(false))

    // MFY zonalari — alohida (kattaroq fayl, keyinroq kerak bo'ladi)
    fetch(`${base}data/mfy.geojson`)
      .then((r) => (r.ok ? r.json() : null))
      .then((m: GeoData | null) => m && setMfy(m))
      .catch(() => {})
  }, [])

  const statsById = useMemo(() => {
    const map: Record<string, RegionStats> = {}
    statsForLevel(regions, 'region', map)
    statsForLevel(districts, 'district', map)
    return map
  }, [regions, districts])

  const national = useMemo(() => {
    const regionStats = regions
      ? regions.features.map((f) => statsById[`region:${f.id}`]).filter(Boolean)
      : []
    const distStats = districts
      ? districts.features.map((f) => statsById[`district:${f.id}`]).filter(Boolean)
      : []
    if (regionStats.length === 0)
      return { totalTrees: 0, avgGreenery: 0, districts: distStats.length }
    // Milliy o'rtacha yashillik — viloyatlar bo'yicha
    const avgGreenery =
      Math.round(
        (regionStats.reduce((s, r) => s + r.greeneryPercent, 0) / regionStats.length) * 10
      ) / 10
    // Jami daraxtlar — tumanlar yig'indisi (batafsilroq)
    const totalTrees = distStats.reduce((s, r) => s + r.treeCount, 0)
    return { totalTrees, avgGreenery, districts: distStats.length }
  }, [regions, districts, statsById])

  return { regions, districts, mfy, statsById, loading, error, national }
}
