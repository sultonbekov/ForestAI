import { useEffect, useMemo, useState } from 'react'
import { MapContainer, GeoJSON, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { Layer, PathOptions } from 'leaflet'
import type { Feature } from 'geojson'
import type { GeoData, RegionStats } from '../types'
import type { Lang } from '../i18n'
import { greeneryColor } from '../data/generateStats'

interface Props {
  regions: GeoData
  districts: GeoData
  statsById: Record<string, RegionStats>
  selectedId: string | null
  onSelect: (id: string) => void
  lang: Lang
}

const BASE_ZOOM = 6 // boshlang'ich zoom
const ZOOMS_TO_DISTRICTS = 5 // 5 marta yaqinlashtirilgach tumanlar ko'rinadi
const ZOOM_THRESHOLD = BASE_ZOOM + ZOOMS_TO_DISTRICTS // = 11

// Zoom darajasini kuzatuvchi kichik yordamchi
function ZoomWatcher({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMap()
  useEffect(() => {
    const handler = () => onZoom(map.getZoom())
    map.on('zoomend', handler)
    onZoom(map.getZoom())
    return () => {
      map.off('zoomend', handler)
    }
  }, [map, onZoom])
  return null
}

// Foiz yozuvlarini divIcon marker sifatida chizamiz
function PercentLabels({
  geo,
  level,
  statsById,
}: {
  geo: GeoData
  level: 'region' | 'district'
  statsById: Record<string, RegionStats>
}) {
  const markers = useMemo(() => {
    const arr: { key: string; lat: number; lng: number; pct: number; name: string }[] = []
    for (const f of geo.features) {
      const st = statsById[`${level}:${f.id}`]
      if (!st) continue
      const lat = f.properties.labelLat
      const lng = f.properties.labelLng
      if (lat == null || lng == null) continue
      arr.push({ key: `${level}:${f.id}`, lat, lng, pct: st.greeneryPercent, name: st.name })
    }
    return arr
  }, [geo, level, statsById])

  return (
    <>
      {markers.map((m) => {
        const big = level === 'region'
        const icon = L.divIcon({
          className: '',
          html: `<div class="pct-label ${big ? 'pct-region' : 'pct-district'}">${
            big ? `<span class="pct-name">${m.name}</span>` : ''
          }<span class="pct-val">${m.pct}%</span></div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        })
        return <Marker key={m.key} position={[m.lat, m.lng]} icon={icon} interactive={false} />
      })}
    </>
  )
}

export default function MapView({
  regions,
  districts,
  statsById,
  selectedId,
  onSelect,
  lang,
}: Props) {
  // Hashdan boshlang'ich ko'rinishni o'qish: #2d@lat,lng,zoom (deep-link / test uchun)
  const hashView = (() => {
    if (typeof window === 'undefined') return null
    const m = window.location.hash.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*),(\d+)/)
    return m
      ? { center: [parseFloat(m[1]), parseFloat(m[2])] as [number, number], zoom: parseInt(m[3]) }
      : null
  })()
  const center: [number, number] = hashView?.center ?? [41.6, 63.5]
  const initialZoom = hashView?.zoom ?? 6
  const [zoom, setZoom] = useState(initialZoom)
  const showDistricts = zoom >= ZOOM_THRESHOLD

  const activeGeo = showDistricts ? districts : regions
  const level: 'region' | 'district' = showDistricts ? 'district' : 'region'

  const styleFor = useMemo(
    () =>
      (feature?: Feature): PathOptions => {
        const key = `${level}:${feature?.id}`
        const st = statsById[key]
        const isSel = key === selectedId
        return {
          fillColor: st ? greeneryColor(st.greeneryPercent) : '#334155',
          weight: isSel ? 3 : level === 'region' ? 1.6 : 0.7,
          color: isSel ? '#ffffff' : 'rgba(255,255,255,0.6)',
          fillOpacity: isSel ? 0.9 : 0.78,
        }
      },
    [statsById, selectedId, level]
  )

  const onEachFeature = useMemo(
    () => (feature: Feature, layer: Layer) => {
      const key = `${level}:${feature.id}`
      const st = statsById[key]
      const props = feature.properties as { name?: string; name_ru?: string }
      const name = (lang === 'ru' && props?.name_ru) || props?.name || ''
      if (st) {
        layer.bindTooltip(
          `<b>${name}</b><br/>${
            lang === 'ru' ? 'Озеленение' : 'Yashillik'
          }: <b>${st.greeneryPercent}%</b> · ${(st.treeCount / 1000).toFixed(0)}k`,
          { className: 'forest-tip', sticky: true }
        )
      }
      layer.on({
        click: () => onSelect(key),
        mouseover: (e) => (e.target as any).setStyle({ fillOpacity: 0.95, weight: 2 }),
        mouseout: (e) => (e.target as any).setStyle(styleFor(feature as Feature)),
      })
    },
    [statsById, onSelect, styleFor, level, lang]
  )

  return (
    <MapContainer
      center={center}
      zoom={initialZoom}
      minZoom={5}
      maxZoom={11}
      className="h-full w-full"
      zoomControl={true}
      attributionControl={false}
    >
      <ZoomWatcher onZoom={setZoom} />
      {/* Real sun'iy yo'ldosh tasviri (Esri World Imagery) */}
      <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
      {/* Shahar / hudud nomlari (yozuvlar) */}
      <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" />
      <GeoJSON
        key={`${level}-${selectedId ?? 'none'}`}
        data={activeGeo as unknown as GeoJSON.GeoJsonObject}
        style={styleFor as any}
        onEachFeature={onEachFeature as any}
      />
      <PercentLabels geo={activeGeo} level={level} statsById={statsById} />
    </MapContainer>
  )
}
