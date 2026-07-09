export interface RegionProperties {
  name: string
  name_ru?: string
  name_uz?: string
  level: 'region' | 'district'
  labelLng?: number
  labelLat?: number
  regionId?: number // tuman uchun — ota viloyat id
  regionName?: string // tuman uchun — ota viloyat nomi
}

export interface TrendPoint {
  year: number
  greeneryPercent: number
}

// Daraxt turi (species) — bargli daraxtlar klassifikatsiyasi
export type SpeciesId =
  | 'chinor'
  | 'dub'
  | 'klen'
  | 'bereza'
  | 'osina'
  | 'iva'
  | 'kashtan'
  | 'ryabina'

export interface SpeciesShare {
  id: SpeciesId
  percent: number // ushbu turdagi daraxtlar ulushi, %
  count: number // taxminiy soni
}

export interface RegionStats {
  id: string
  name: string
  greeneryPercent: number // umumiy yashillik darajasi, %
  treeCount: number // jami daraxtlar soni
  healthyPercent: number // sog'lom daraxtlar ulushi, %
  atRiskCount: number // kasal / xavf ostidagi daraxtlar
  deadCount: number // nobud bo'lgan daraxtlar
  newlyPlanted: number // shu yil ekilgan
  avgNdvi: number // o'rtacha NDVI (0..1)
  perCapitaM2: number // aholi jon boshiga yashil hudud, m2
  lastSurveyDate: string
  trend: TrendPoint[] // 2021..2026
  species: SpeciesShare[] // daraxt turlari taqsimoti (kamayish bo'yicha)
}

export type ViewMode = '2d' | '3d'

export interface GeoFeature {
  type: 'Feature'
  id: number | string
  properties: RegionProperties
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: number[][][] | number[][][][]
  }
}

export interface GeoData {
  type: 'FeatureCollection'
  features: GeoFeature[]
}
