import { useEffect, useMemo, useState } from 'react'
import { MapContainer, GeoJSON, TileLayer, ImageOverlay, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { Layer, PathOptions } from 'leaflet'
import type { Feature } from 'geojson'
import type { GeoData, RegionStats } from '../types'
import type { Lang } from '../i18n'
import { greeneryColor, generateZoneStats, CATEGORY_COLORS } from '../data/generateStats'

// Copernicus Sentinel-2 tasviri (O'zbekiston chegarasi bo'yicha clip qilingan)
const SAT_BOUNDS: L.LatLngBoundsExpression = [
  [37.1, 55.9],
  [45.6, 73.2],
]

interface Props {
  regions: GeoData
  districts: GeoData
  mfy: GeoData | null
  statsById: Record<string, RegionStats>
  selectedId: string | null
  onSelect: (id: string) => void
  onSelectZone: (zoneId: string | null) => void
  lang: Lang
}

const BASE_ZOOM = 6
const ZOOM_DISTRICTS = 11 // 5 marta yaqinlashtirilgach tumanlar
const ZOOM_MFY = 12 // undan yuqorida — MFY zonalari

// Zoom + xarita instansiyasini kuzatish
function MapController({
  onZoom,
  flyToId,
  mfy,
}: {
  onZoom: (z: number) => void
  flyToId: string | null
  mfy: GeoData | null
}) {
  const map = useMap()
  useEffect(() => {
    const handler = () => onZoom(map.getZoom())
    map.on('zoomend', handler)
    onZoom(map.getZoom())
    return () => {
      map.off('zoomend', handler)
    }
  }, [map, onZoom])

  // Tanlangan zonaga uchib borish
  useEffect(() => {
    if (!flyToId || !mfy) return
    const id = flyToId.replace('mfy:', '')
    const f = mfy.features.find((ff) => String(ff.id) === id)
    if (!f) return
    const layer = L.geoJSON(f as any)
    map.flyToBounds(layer.getBounds(), { maxZoom: 14, padding: [40, 40], duration: 0.8 })
  }, [flyToId, mfy, map])

  return null
}

// Dominant kategoriya bo'yicha zona rangi
function zoneColor(zoneId: string, name: string): string {
  const zs = generateZoneStats(zoneId, name, '')
  const last = zs.years[zs.years.length - 1]
  const cats: [string, number][] = [
    ['healthy', last.healthy],
    ['atRisk', last.atRisk],
    ['dead', last.dead],
    ['planted', last.planted],
  ]
  cats.sort((a, b) => b[1] - a[1])
  return CATEGORY_COLORS[cats[0][0]]
}

// Foiz yozuvlari (region/district)
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
  mfy,
  statsById,
  selectedId,
  onSelect,
  onSelectZone,
  lang,
}: Props) {
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
  const [flyToId, setFlyToId] = useState<string | null>(null)

  const showMfy = zoom >= ZOOM_MFY && !!mfy
  const showDistricts = zoom >= ZOOM_DISTRICTS && !showMfy
  const level: 'region' | 'district' = showDistricts || showMfy ? 'district' : 'region'
  const activeGeo = showDistricts ? districts : regions

  // --- Region / District qatlami stili ---
  const styleFor = useMemo(
    () =>
      (feature?: Feature): PathOptions => {
        const key = `${level}:${feature?.id}`
        const st = statsById[key]
        const isSel = key === selectedId
        return {
          fillColor: st ? greeneryColor(st.greeneryPercent) : '#334155',
          weight: isSel ? 3 : level === 'region' ? 1.6 : 0.7,
          color: isSel ? '#ffffff' : 'rgba(255,255,255,0.55)',
          fillOpacity: showMfy ? 0 : 1,
        }
      },
    [statsById, selectedId, level, showMfy]
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
        mouseover: (e) => (e.target as any).setStyle({ fillOpacity: showMfy ? 0 : 1, weight: 2 }),
        mouseout: (e) => (e.target as any).setStyle(styleFor(feature as Feature)),
      })
    },
    [statsById, onSelect, styleFor, level, lang, showMfy]
  )

  // --- MFY qatlami ---
  const mfyStyle = useMemo(
    () =>
      (feature?: Feature): PathOptions => {
        const key = `mfy:${feature?.id}`
        const nm = (feature?.properties as { name?: string })?.name ?? ''
        const isSel = key === selectedId
        return {
          fillColor: zoneColor(key, nm),
          weight: isSel ? 2.5 : 0.8,
          color: isSel ? '#ffffff' : 'rgba(255,255,255,0.7)',
          fillOpacity: isSel ? 0.9 : 0.72,
        }
      },
    [selectedId]
  )

  const onEachMfy = useMemo(
    () => (feature: Feature, layer: Layer) => {
      const id = String(feature.id)
      const props = feature.properties as { name?: string; districtName?: string }
      layer.bindTooltip(
        `<b>${props.name ?? ''}</b><br/>${props.districtName ?? ''}`,
        { className: 'forest-tip', sticky: true }
      )
      layer.on({
        click: () => {
          onSelectZone(`mfy:${id}`)
          setFlyToId(`mfy:${id}`)
        },
        mouseover: (e) => (e.target as any).setStyle({ fillOpacity: 0.92, weight: 1.6 }),
        mouseout: (e) => (e.target as any).setStyle(mfyStyle(feature as Feature)),
      })
    },
    [onSelectZone, mfyStyle]
  )

  return (
    <MapContainer
      center={center}
      zoom={initialZoom}
      minZoom={5}
      maxZoom={15}
      className="h-full w-full"
      zoomControl={true}
      attributionControl={false}
    >
      <MapController onZoom={setZoom} flyToId={flyToId} mfy={mfy} />

      {/* Esri World Imagery — kontekst */}
      <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
      {/* Copernicus Sentinel-2 — O'zbekiston statik PNG (tayl-serversiz) */}
      <ImageOverlay
        url={`${import.meta.env.BASE_URL}data/uzb_satellite.png`}
        bounds={SAT_BOUNDS}
        opacity={1}
      />
      {/* Nomlar */}
      <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" />

      {/* Region / District maskalari */}
      <GeoJSON
        key={`${level}-${showMfy ? 'mfy' : 'base'}-${selectedId ?? 'none'}`}
        data={activeGeo as unknown as GeoJSON.GeoJsonObject}
        style={styleFor as any}
        onEachFeature={onEachFeature as any}
      />

      {/* MFY zonalari (chuqur zoom) */}
      {showMfy && mfy && (
        <GeoJSON
          key={`mfy-layer-${selectedId ?? 'none'}`}
          data={mfy as unknown as GeoJSON.GeoJsonObject}
          style={mfyStyle as any}
          onEachFeature={onEachMfy as any}
        />
      )}

      {!showMfy && (
        <PercentLabels geo={activeGeo} level={level} statsById={statsById} />
      )}
    </MapContainer>
  )
}
