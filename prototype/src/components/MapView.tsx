import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, GeoJSON, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { Layer, PathOptions } from 'leaflet'
import type { Feature } from 'geojson'
import type { GeoData, RegionStats } from '../types'
import type { Lang } from '../i18n'
import { greeneryColor, generateZoneStats, CATEGORY_COLORS } from '../data/generateStats'

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

// Bitta canvas'da barcha daraxt nuqtalarini chizadigan yengil qatlam.
// 220 ta alohida marker o'rniga — bitta overlay, har kadr setStyle yo'q.
// Daraxt nuqtalari — Leaflet'ning o'z canvas renderer'i orqali circleMarker.
// Nuqtalar xarita bilan to'g'ri harakatlanadi (zoom/pan da joyida turadi),
// yil o'zgarganda faqat rang/ko'rinish yangilanadi (har kadr emas).
function ZoneTrees({
  feature,
  zoneKey,
  yearIdx,
}: {
  feature: Feature
  zoneKey: string
  yearIdx: number
  yearCount: number
}) {
  const map = useMap()
  const trees = useMemo(() => buildZoneTrees(feature, zoneKey), [feature, zoneKey])

  // Bir marta renderer + markerlar yaratamiz
  const { group, markers } = useMemo(() => {
    const renderer = L.canvas({ padding: 0.5 })
    const group = L.layerGroup()
    const markers = trees.map((t) =>
      L.circleMarker([t.lat, t.lng], {
        renderer,
        radius: 3,
        weight: 0,
        fillOpacity: 0,
        interactive: false,
      })
    )
    markers.forEach((m) => m.addTo(group))
    return { group, markers }
  }, [trees])

  useEffect(() => {
    group.addTo(map)
    // Zoom bo'yicha nuqta radiusi (yaqinlashtirilганда kattaroq)
    const applyRadius = () => {
      const z = map.getZoom()
      const r = Math.max(2.5, Math.min(7, (z - 9) * 1.4))
      markers.forEach((m) => m.setRadius(r))
    }
    applyRadius()
    map.on('zoomend', applyRadius)
    return () => {
      map.off('zoomend', applyRadius)
      map.removeLayer(group)
    }
  }, [map, group, markers])

  // Yil o'zgarganda markerlar rangini yangilash
  useEffect(() => {
    markers.forEach((m, i) => {
      const cat = trees[i].byYear[yearIdx]
      if (!cat) {
        m.setStyle({ fillOpacity: 0 })
      } else {
        m.setStyle({ fillColor: CATEGORY_COLORS[cat], fillOpacity: 0.9, stroke: false })
      }
    })
  }, [markers, trees, yearIdx])

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

// --- MFY qatlami: Canvas renderer + viewport-culling ---
// 9452 SVG path o'rniga: canvas'da chizish + faqat ko'rinadigan mahallalarni
// render qilish (moveend'da qayta hisoblanadi). Bu FPS'ni keskin oshiradi.
interface BBox {
  minx: number
  miny: number
  maxx: number
  maxy: number
}
function featureBBox(f: Feature): BBox {
  let minx = Infinity,
    miny = Infinity,
    maxx = -Infinity,
    maxy = -Infinity
  const walk = (o: any) => {
    if (typeof o[0] === 'number') {
      if (o[0] < minx) minx = o[0]
      if (o[0] > maxx) maxx = o[0]
      if (o[1] < miny) miny = o[1]
      if (o[1] > maxy) maxy = o[1]
    } else for (const x of o) walk(x)
  }
  walk((f.geometry as any).coordinates)
  return { minx, miny, maxx, maxy }
}

function MfyCulledLayer({
  mfy,
  selectedZoneId,
  onSelectZone,
  onFlyTo,
}: {
  mfy: GeoData
  selectedZoneId: string | null
  onSelectZone: (id: string) => void
  onFlyTo: (id: string) => void
}) {
  const map = useMap()
  const bboxes = useMemo(() => mfy.features.map((f) => featureBBox(f as unknown as Feature)), [mfy])
  const rendererRef = useMemo(() => L.canvas({ padding: 0.3 }), [])

  // Callbacklar va tanlov — ref orqali (har doim yangi, effekt qayta qurilmasin)
  const selRef = useRef<string | null>(selectedZoneId)
  selRef.current = selectedZoneId
  const cbRef = useRef({ onSelectZone, onFlyTo })
  cbRef.current = { onSelectZone, onFlyTo }
  const layerHolder = useRef<any>(null)

  // Qatlam va update funksiyasini bir marta yaratamiz
  useEffect(() => {
    const styleFn = (feature?: Feature): PathOptions => {
      const isSel = feature ? `mfy:${feature.id}` === selRef.current : false
      return {
        fillColor: '#22c55e',
        weight: isSel ? 3 : 1,
        color: isSel ? '#ffffff' : 'rgba(255,255,255,0.8)',
        fillOpacity: isSel ? 0.1 : 0.01,
      }
    }
    const layer = L.geoJSON(undefined, {
      renderer: rendererRef,
      style: styleFn,
      onEachFeature: (feature: Feature, lyr: Layer) => {
        const id = String(feature.id)
        const props = feature.properties as { name?: string; districtName?: string }
        lyr.bindTooltip(`<b>${props.name ?? ''}</b><br/>${props.districtName ?? ''}`, {
          className: 'forest-tip',
          sticky: true,
        })
        lyr.on('click', (e: any) => {
          L.DomEvent.stopPropagation(e)
          cbRef.current.onSelectZone(`mfy:${id}`)
          cbRef.current.onFlyTo(`mfy:${id}`)
        })
      },
    } as any).addTo(map)
    ;(layer as any)._styleFn = styleFn

    const rebuild = () => {
      const b = map.getBounds().pad(0.25)
      const w = b.getWest(),
        e = b.getEast(),
        s = b.getSouth(),
        n = b.getNorth()
      const visible: Feature[] = []
      for (let i = 0; i < mfy.features.length; i++) {
        const bb = bboxes[i]
        if (bb.maxx < w || bb.minx > e || bb.maxy < s || bb.miny > n) continue
        visible.push(mfy.features[i] as Feature)
        if (visible.length > 900) break
      }
      layer.clearLayers()
      layer.addData({ type: 'FeatureCollection', features: visible } as any)
    }
    rebuild()
    map.on('moveend zoomend', rebuild)
    layerHolder.current = layer

    return () => {
      map.off('moveend zoomend', rebuild)
      map.removeLayer(layer)
      layerHolder.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, mfy, bboxes, rendererRef])

  // Tanlov o'zgarganda — qayta qurmasdan faqat stilni yangilaymiz
  useEffect(() => {
    const layer = layerHolder.current
    if (!layer) return
    layer.setStyle((layer as any).options.style)
  }, [selectedZoneId])

  return null
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
  // Daraxtlar — zona tanlangan bo'lsa va yetarli yaqinlashtirilganda ko'rsatiladi
  const showTrees = !!selectedZoneId && zoom >= ZOOM_MFY
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

  return (
    <MapContainer
      center={center}
      zoom={initialZoom}
      minZoom={5}
      maxZoom={15}
      className="h-full w-full"
      zoomControl={true}
      attributionControl={false}
      preferCanvas={true}
    >
      <MapController onZoom={setZoom} flyToId={flyToId} mfy={mfy} />

      {/* Esri World Imagery — sun'iy yo'ldosh fon (publik, barcha zoomlarda aniq) */}
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        maxNativeZoom={19}
        maxZoom={19}
      />
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

      {/* MFY zonalari — canvas + viewport-culling (yengil) */}
      {showMfy && mfy && (
        <MfyCulledLayer
          mfy={mfy}
          selectedZoneId={selectedZoneId}
          onSelectZone={onSelectZone}
          onFlyTo={setFlyToId}
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
