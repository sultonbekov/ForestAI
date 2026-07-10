import { useEffect, useMemo, useState } from 'react'
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
const TreeCanvasLayer = L.Layer.extend({
  initialize(this: any, trees: TreePt[]) {
    this._trees = trees
    this._yearIdx = 0
    this._alpha = 1
  },
  onAdd(this: any, map: L.Map) {
    this._map = map
    const canvas = L.DomUtil.create('canvas', 'leaflet-zoom-animated') as HTMLCanvasElement
    this._canvas = canvas
    const size = map.getSize()
    canvas.width = size.x
    canvas.height = size.y
    map.getPanes().overlayPane.appendChild(canvas)
    map.on('moveend zoomend resize viewreset', this._reset, this)
    map.on('move', this._onMove, this)
    this._reset()
    return this
  },
  onRemove(this: any, map: L.Map) {
    cancelAnimationFrame(this._raf)
    if (this._canvas.parentNode) map.getPanes().overlayPane.removeChild(this._canvas)
    map.off('moveend zoomend resize viewreset', this._reset, this)
    map.off('move', this._onMove, this)
    this._map = null
  },
  setYear(this: any, yearIdx: number) {
    this._yearIdx = yearIdx
    this._alpha = 0
    const start = performance.now()
    const step = () => {
      if (!this._map) return
      this._alpha = Math.min(1, (performance.now() - start) / 350)
      this._draw()
      if (this._alpha < 1) this._raf = requestAnimationFrame(step)
    }
    cancelAnimationFrame(this._raf)
    this._raf = requestAnimationFrame(step)
  },
  _onMove(this: any) {
    if (!this._map) return
    const topLeft = this._map.containerPointToLayerPoint([0, 0])
    L.DomUtil.setPosition(this._canvas, topLeft)
    this._draw()
  },
  _reset(this: any) {
    if (!this._map) return
    const size = this._map.getSize()
    this._canvas.width = size.x
    this._canvas.height = size.y
    const topLeft = this._map.containerPointToLayerPoint([0, 0])
    L.DomUtil.setPosition(this._canvas, topLeft)
    this._draw()
  },
  _draw(this: any) {
    if (!this._map) return
    const ctx = this._canvas.getContext('2d') as CanvasRenderingContext2D
    const map = this._map
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height)
    const yi = this._yearIdx
    const a = this._alpha
    const bounds = map.getBounds().pad(0.1)
    for (const t of this._trees as TreePt[]) {
      const cat = t.byYear[yi]
      if (!cat) continue
      if (t.lat < bounds.getSouth() || t.lat > bounds.getNorth()) continue
      if (t.lng < bounds.getWest() || t.lng > bounds.getEast()) continue
      const p = map.latLngToLayerPoint([t.lat, t.lng])
      const origin = map.containerPointToLayerPoint([0, 0])
      const x = p.x - origin.x
      const y = p.y - origin.y
      ctx.globalAlpha = 0.9 * a
      ctx.fillStyle = CATEGORY_COLORS[cat]
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  },
})

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
  const layerRef = useMemo(() => new (TreeCanvasLayer as any)(trees), [trees])

  useEffect(() => {
    layerRef.addTo(map)
    return () => {
      map.removeLayer(layerRef)
    }
  }, [map, layerRef])

  useEffect(() => {
    layerRef.setYear(yearIdx)
  }, [layerRef, yearIdx])

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
  // bbox'larni bir marta hisoblaymiz
  const bboxes = useMemo(() => mfy.features.map((f) => featureBBox(f as unknown as Feature)), [mfy])
  const rendererRef = useMemo(() => L.canvas({ padding: 0.3 }), [])
  const selRef = useMemo(() => ({ id: selectedZoneId }), [])
  selRef.id = selectedZoneId

  useEffect(() => {
    const layer = L.geoJSON(undefined, {
      renderer: rendererRef,
      style: (feature?: Feature): PathOptions => {
        const isSel = feature ? `mfy:${feature.id}` === selRef.id : false
        return {
          fillColor: '#22c55e',
          weight: isSel ? 3 : 1,
          color: isSel ? '#ffffff' : 'rgba(255,255,255,0.8)',
          fillOpacity: isSel ? 0.08 : 0.01,
        }
      },
      onEachFeature: (feature: Feature, lyr: Layer) => {
        const id = String(feature.id)
        const props = feature.properties as { name?: string; districtName?: string }
        lyr.bindTooltip(`<b>${props.name ?? ''}</b><br/>${props.districtName ?? ''}`, {
          className: 'forest-tip',
          sticky: true,
        })
        lyr.on('click', () => {
          onSelectZone(`mfy:${id}`)
          onFlyTo(`mfy:${id}`)
        })
      },
    } as any).addTo(map)

    let lastKey = ''
    const update = () => {
      const b = map.getBounds().pad(0.25)
      const w = b.getWest(),
        e = b.getEast(),
        s = b.getSouth(),
        n = b.getNorth()
      const z = map.getZoom()
      // limit — juda ko'p bo'lsa ham cheklaymiz
      const visible: Feature[] = []
      for (let i = 0; i < mfy.features.length; i++) {
        const bb = bboxes[i]
        if (bb.maxx < w || bb.minx > e || bb.maxy < s || bb.miny > n) continue
        visible.push(mfy.features[i] as Feature)
        if (visible.length > 900) break
      }
      const key = `${z.toFixed(1)}:${visible.length}:${Math.round(w * 100)}:${Math.round(s * 100)}`
      if (key === lastKey) return
      lastKey = key
      layer.clearLayers()
      layer.addData({ type: 'FeatureCollection', features: visible } as any)
    }
    update()
    map.on('moveend zoomend', update)

    return () => {
      map.off('moveend zoomend', update)
      map.removeLayer(layer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, mfy, bboxes, rendererRef])

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
