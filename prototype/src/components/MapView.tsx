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
  selectedZoneId: string | null
  selectedYear: number
  onSelect: (id: string) => void
  onSelectZone: (zoneId: string | null) => void
  lang: Lang
}

const ZOOM_DISTRICTS = 8 // tumanlar (avvalroq ko'rinadi)
const ZOOM_MFY = 11 // MFY zonalari
const ZOOM_TREES = 13 // daraxt nuqtalari (chuqurroq)

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

// --- Zona ichidagi daraxt nuqtalari (yil bo'yicha, animatsiya bilan) ---
type TreeCat = 'healthy' | 'atRisk' | 'dead' | 'planted'
interface TreePt {
  lat: number
  lng: number
  // har yil uchun kategoriya (yoki null — hali ekilmagan)
  byYear: (TreeCat | null)[]
}

function mulberry(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0],
      yi = ring[i][1],
      xj = ring[j][0],
      yj = ring[j][1]
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

// Zona uchun daraxt nuqtalarini generatsiya qilish (deterministik)
function buildZoneTrees(feature: Feature, zoneKey: string): TreePt[] {
  const geom = feature.geometry as any
  const rings: number[][][] =
    geom.type === 'Polygon' ? geom.coordinates : geom.coordinates.flat()
  const outer = rings[0]
  let minx = Infinity,
    miny = Infinity,
    maxx = -Infinity,
    maxy = -Infinity
  for (const [x, y] of outer) {
    if (x < minx) minx = x
    if (x > maxx) maxx = x
    if (y < miny) miny = y
    if (y > maxy) maxy = y
  }

  const zs = generateZoneStats(zoneKey, (feature.properties as any)?.name ?? '', '')
  const years = zs.years
  const NPTS = 220 // namuna (performans uchun)
  const rand = mulberry(
    zoneKey.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7) >>> 0
  )

  const pts: TreePt[] = []
  let guard = 0
  while (pts.length < NPTS && guard < NPTS * 60) {
    guard++
    const lng = minx + rand() * (maxx - minx)
    const lat = miny + rand() * (maxy - miny)
    if (!pointInRing(lng, lat, outer)) continue
    pts.push({ lat, lng, byYear: [] })
  }

  // Oxirgi yil jami (nuqta zichligini normallash uchun)
  const lastY = years[years.length - 1]
  const lastTotal = lastY.healthy + lastY.atRisk + lastY.dead + lastY.planted

  // Har yil uchun kategoriyalar taqsimoti nuqtalarga proporsional
  for (let yi = 0; yi < years.length; yi++) {
    const y = years[yi]
    const total = y.healthy + y.atRisk + y.dead + y.planted
    // shu yilda faol nuqtalar soni (o'sib boradi)
    const active = Math.round((pts.length * total) / lastTotal)
    const nDead = Math.round((active * y.dead) / total)
    const nAtRisk = Math.round((active * y.atRisk) / total)
    const nPlanted = Math.round((active * y.planted) / total)
    // Birinchi `active` nuqta faol; oxirgi nPlanted — shu yil ekilgan
    pts.forEach((p, i) => {
      if (i >= active) {
        p.byYear[yi] = null
      } else if (i < nDead) {
        p.byYear[yi] = 'dead'
      } else if (i < nDead + nAtRisk) {
        p.byYear[yi] = 'atRisk'
      } else if (i >= active - nPlanted) {
        p.byYear[yi] = 'planted'
      } else {
        p.byYear[yi] = 'healthy'
      }
    })
  }

  return pts
}

function ZoneTrees({
  feature,
  zoneKey,
  yearIdx,
  yearCount,
}: {
  feature: Feature
  zoneKey: string
  yearIdx: number
  yearCount: number
}) {
  const map = useMap()

  const trees = useMemo(() => buildZoneTrees(feature, zoneKey), [feature, zoneKey])

  useEffect(() => {
    const renderer = L.canvas({ padding: 0.5 })
    const layerGroup = L.layerGroup().addTo(map)
    const markers: L.CircleMarker[] = []
    for (const t of trees) {
      const m = L.circleMarker([t.lat, t.lng], {
        renderer,
        radius: 3.2,
        weight: 0.5,
        color: 'rgba(0,0,0,0.35)',
        fillOpacity: 0,
        opacity: 0,
      })
      m.addTo(layerGroup)
      markers.push(m)
    }

    // Yil o'zgarganda silliq (fade) o'tish
    let raf = 0
    const start = performance.now()
    const DUR = 500
    function animate() {
      const t = Math.min(1, (performance.now() - start) / DUR)
      trees.forEach((tree, i) => {
        const cat = tree.byYear[Math.min(yearIdx, yearCount - 1)]
        const mk = markers[i]
        if (!cat) {
          mk.setStyle({ fillOpacity: 0, opacity: 0 })
        } else {
          const col = CATEGORY_COLORS[cat]
          mk.setStyle({
            fillColor: col,
            fillOpacity: 0.9 * t,
            opacity: 0.6 * t,
          })
        }
      })
      if (t < 1) raf = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      cancelAnimationFrame(raf)
      map.removeLayer(layerGroup)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trees, yearIdx])

  return null
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
  selectedZoneId,
  selectedYear,
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
  const showTrees = zoom >= ZOOM_TREES
  const level: 'region' | 'district' = showDistricts || showMfy ? 'district' : 'region'
  const activeGeo = showDistricts ? districts : regions

  // Tanlangan zona feature'i (daraxt nuqtalari uchun)
  const selectedZoneFeature = useMemo(() => {
    if (!selectedZoneId || !mfy) return null
    const id = selectedZoneId.replace('mfy:', '')
    return (mfy.features.find((f) => String(f.id) === id) as Feature) ?? null
  }, [selectedZoneId, mfy])

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

  // --- MFY qatlami: FAQAT CHEGARA (to'ldirishsiz), zichligiga qarab yashil tus ---
  const mfyStyle = useMemo(
    () =>
      (feature?: Feature): PathOptions => {
        const key = `mfy:${feature?.id}`
        const isSel = key === selectedZoneId
        return {
          fillColor: '#22c55e',
          weight: isSel ? 3 : 1.2,
          color: isSel ? '#ffffff' : 'rgba(255,255,255,0.85)',
          fillOpacity: isSel ? 0.08 : 0.02, // deyarli shaffof — faqat chegara
        }
      },
    [selectedZoneId]
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
        mouseover: (e) => (e.target as any).setStyle({ fillOpacity: 0.15, weight: 2 }),
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

      {/* Esri World Imagery — chuqur zoomda aniq (4K) tasvir manbai */}
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        maxNativeZoom={19}
        maxZoom={19}
      />
      {/* Copernicus Sentinel-2 — faqat uzoq zoomda (MFY/zona rejimida Esri aniqroq) */}
      {!showMfy && (
        <ImageOverlay
          url={`${import.meta.env.BASE_URL}data/uzb_satellite.png`}
          bounds={SAT_BOUNDS}
          opacity={1}
        />
      )}
      {/* Nomlar */}
      <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" />

      {/* Region / District maskalari (zona rejimida yashiriladi) */}
      {!showMfy && (
        <GeoJSON
          key={`${level}-${selectedId ?? 'none'}`}
          data={activeGeo as unknown as GeoJSON.GeoJsonObject}
          style={styleFor as any}
          onEachFeature={onEachFeature as any}
        />
      )}

      {/* MFY zonalari — faqat chegara */}
      {showMfy && mfy && (
        <GeoJSON
          key={`mfy-layer-${selectedZoneId ?? 'none'}`}
          data={mfy as unknown as GeoJSON.GeoJsonObject}
          style={mfyStyle as any}
          onEachFeature={onEachMfy as any}
        />
      )}

      {/* Tanlangan zona ichida daraxt nuqtalari (yil bo'yicha, animatsiya) */}
      {showTrees && selectedZoneFeature && selectedZoneId && (
        <ZoneTrees
          feature={selectedZoneFeature}
          zoneKey={selectedZoneId}
          yearIdx={selectedYear - 2021}
          yearCount={6}
        />
      )}

      {!showMfy && (
        <PercentLabels geo={activeGeo} level={level} statsById={statsById} />
      )}
    </MapContainer>
  )
}
