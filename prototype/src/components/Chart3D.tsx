import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { GeoData, RegionStats } from '../types'
import type { Lang } from '../i18n'
import { greeneryColor } from '../data/generateStats'

interface Props {
  regions: GeoData
  districts: GeoData
  statsById: Record<string, RegionStats>
  level: 'region' | 'district'
  filterRegionId: number | null // tuman rejimida: faqat shu viloyat tumanlari
  selectedId: string | null
  onSelect: (id: string) => void
  lang: Lang
}

interface Bar {
  key: string
  name: string
  pct: number
}

// 3D ustunli diagramma (bar chart) — har bir ustun balandligi yashillik %.
// Viloyat rejimida 14 ta, Tuman rejimida eng yuqori 24 ta tuman ko'rsatiladi.
export default function Chart3D({
  regions,
  districts,
  statsById,
  level,
  filterRegionId,
  selectedId,
  onSelect,
  lang,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const selectRef = useRef(onSelect)
  selectRef.current = onSelect
  const meshesRef = useRef<THREE.Mesh[]>([])
  const selectedRef = useRef<string | null>(selectedId)
  selectedRef.current = selectedId
  const highlightRef = useRef<(() => void) | null>(null)

  const bars: Bar[] = useMemo(() => {
    const src = level === 'region' ? regions : districts
    const list: Bar[] = []
    for (const f of src.features) {
      const props = f.properties as {
        name?: string
        name_ru?: string
        regionId?: number
      }
      // Tuman rejimida viloyat filtri
      if (level === 'district' && filterRegionId != null && props.regionId !== filterRegionId)
        continue
      const key = `${level}:${f.id}`
      const st = statsById[key]
      if (!st) continue
      const name = (lang === 'ru' && props.name_ru) || props.name || st.name
      list.push({ key, name, pct: st.greeneryPercent })
    }
    list.sort((a, b) => b.pct - a.pct)
    // Viloyat tanlanmagan bo'lsa — eng yashil 24 tasi; tanlangan bo'lsa — hammasi
    if (level === 'district' && filterRegionId == null) return list.slice(0, 24)
    return list
  }, [regions, districts, statsById, level, lang, filterRegionId])

  useEffect(() => {
    const mountEl = mountRef.current
    if (!mountEl) return
    const el: HTMLDivElement = mountEl
    const width = el.clientWidth
    const height = el.clientHeight

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0b1220')

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    el.appendChild(renderer.domElement)

    // Yorug'lik
    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const key = new THREE.DirectionalLight(0xffffff, 1.15)
    key.position.set(6, 14, 8)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.near = 1
    key.shadow.camera.far = 80
    const s = 30
    key.shadow.camera.left = -s
    key.shadow.camera.right = s
    key.shadow.camera.top = s
    key.shadow.camera.bottom = -s
    scene.add(key)
    scene.add(new THREE.DirectionalLight(0x22c55e, 0.25).translateX(-8).translateY(4).translateZ(-8))

    const group = new THREE.Group()
    scene.add(group)

    // O'lchamlar
    const n = bars.length
    const barW = 1.1
    const gap = 0.7
    const step = barW + gap
    const totalW = n * step - gap
    const maxH = 9
    const maxPct = 30 // Farmon maqsadi

    // Zamin (grid)
    const groundGeo = new THREE.PlaneGeometry(totalW + 8, 14)
    const ground = new THREE.Mesh(
      groundGeo,
      new THREE.MeshStandardMaterial({ color: '#0e1526', roughness: 1 })
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.set(0, 0, 0)
    ground.receiveShadow = true
    group.add(ground)

    const grid = new THREE.GridHelper(totalW + 8, Math.max(8, n), 0x1e293b, 0x162032)
    ;(grid.material as THREE.Material).transparent = true
    ;(grid.material as THREE.Material).opacity = 0.5
    group.add(grid)

    // Ustunlar
    const meshes: THREE.Mesh[] = []
    const labelData: { key: string; name: string; pct: number; x: number; h: number }[] = []
    bars.forEach((b, i) => {
      const h = 0.3 + (Math.min(maxPct, b.pct) / maxPct) * maxH
      const geom = new THREE.BoxGeometry(barW, h, barW)
      geom.translate(0, h / 2, 0)
      const color = new THREE.Color(greeneryColor(b.pct))
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.35,
        metalness: 0.15,
      })
      const mesh = new THREE.Mesh(geom, mat)
      const x = i * step - totalW / 2 + barW / 2
      mesh.position.set(x, 0, 0)
      mesh.scale.y = 0.001 // o'sish animatsiyasi uchun 0 dan boshlanadi
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.userData = { key: b.key, baseColor: color.clone(), pct: b.pct, delay: i * 0.04 }
      group.add(mesh)
      meshes.push(mesh)
      labelData.push({ key: b.key, name: b.name, pct: b.pct, x, h })
    })
    meshesRef.current = meshes

    // O'sish animatsiyasi holati
    const animStart = performance.now()
    const GROW_DUR = 850 // ms
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

    // HTML yozuvlar (foiz + nom)
    const labelLayer = document.createElement('div')
    labelLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden'
    el.appendChild(labelLayer)
    const labelEls = labelData.map((d) => {
      const div = document.createElement('div')
      div.className = 'bar3d-label'
      div.innerHTML = `<span class="b3-val">${d.pct}%</span><span class="b3-name">${d.name}</span>`
      labelLayer.appendChild(div)
      return { div, x: d.x, h: d.h, top: new THREE.Vector3(d.x, d.h + 0.4, 0) }
    })

    // Kamera boshlang'ich holati
    const camDist = Math.max(18, totalW * 0.85)
    let theta = -Math.PI / 2.6
    let phi = 0.72
    let radius = camDist
    const target = new THREE.Vector3(0, maxH * 0.32, 0)

    // Raycast
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let hovered: THREE.Mesh | null = null

    function setPointer(ev: PointerEvent) {
      const r = renderer.domElement.getBoundingClientRect()
      pointer.x = ((ev.clientX - r.left) / r.width) * 2 - 1
      pointer.y = -((ev.clientY - r.top) / r.height) * 2 + 1
    }
    function pick(): THREE.Mesh | null {
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(meshes, false)
      return hits.length ? (hits[0].object as THREE.Mesh) : null
    }
    function highlight() {
      for (const m of meshes) {
        const base = m.userData.baseColor as THREE.Color
        const mat = m.material as THREE.MeshStandardMaterial
        const isSel = m.userData.key === selectedRef.current
        const isHov = m === hovered
        if (isSel) {
          mat.color.copy(base).lerp(new THREE.Color('#ffffff'), 0.4)
          mat.emissive = new THREE.Color('#0e3a1f')
          mat.emissiveIntensity = 0.6
        } else if (isHov) {
          mat.color.copy(base).lerp(new THREE.Color('#ffffff'), 0.22)
          mat.emissive = new THREE.Color('#000000')
          mat.emissiveIntensity = 0
        } else {
          mat.color.copy(base)
          mat.emissive = new THREE.Color('#000000')
          mat.emissiveIntensity = 0
        }
      }
    }

    let dragging = false
    let px = 0
    let py = 0
    let downX = 0
    let downY = 0
    function onDown(ev: PointerEvent) {
      dragging = true
      px = downX = ev.clientX
      py = downY = ev.clientY
      renderer.domElement.style.cursor = 'grabbing'
    }
    function onMove(ev: PointerEvent) {
      setPointer(ev)
      if (dragging) {
        theta -= (ev.clientX - px) * 0.006
        phi = Math.max(0.2, Math.min(1.35, phi - (ev.clientY - py) * 0.005))
        px = ev.clientX
        py = ev.clientY
      } else {
        const hit = pick()
        if (hit !== hovered) {
          hovered = hit
          renderer.domElement.style.cursor = hit ? 'pointer' : 'grab'
          highlight()
        }
      }
    }
    function onUp(ev: PointerEvent) {
      dragging = false
      renderer.domElement.style.cursor = 'grab'
      if (Math.abs(ev.clientX - downX) + Math.abs(ev.clientY - downY) < 5) {
        setPointer(ev)
        const hit = pick()
        if (hit) selectRef.current(hit.userData.key as string)
      }
    }
    function onWheel(ev: WheelEvent) {
      ev.preventDefault()
      radius = Math.max(10, Math.min(camDist * 2.2, radius + ev.deltaY * 0.03))
    }

    const dom = renderer.domElement
    dom.style.cursor = 'grab'
    dom.addEventListener('pointerdown', onDown)
    dom.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    dom.addEventListener('wheel', onWheel, { passive: false })

    highlight()
    highlightRef.current = highlight

    let raf = 0
    const v = new THREE.Vector3()
    function animate() {
      raf = requestAnimationFrame(animate)

      // O'sish animatsiyasi (har bir ustun ketma-ket pastdan yuqoriga o'sadi)
      const now = performance.now()
      let growing = false
      for (const m of meshes) {
        const delay = (m.userData.delay as number) * 1000
        const t = Math.min(1, Math.max(0, (now - animStart - delay) / GROW_DUR))
        m.scale.y = Math.max(0.001, easeOut(t))
        if (t < 1) growing = true
      }

      camera.position.set(
        target.x + radius * Math.sin(phi) * Math.cos(theta),
        target.y + radius * Math.cos(phi),
        target.z + radius * Math.sin(phi) * Math.sin(theta)
      )
      camera.lookAt(target)
      renderer.render(scene, camera)

      const w = dom.clientWidth
      const h = dom.clientHeight
      labelEls.forEach((lb, i) => {
        const scaleY = meshes[i] ? meshes[i].scale.y : 1
        lb.top.set(lb.x, lb.h * scaleY + 0.4, 0)
        v.copy(lb.top).project(camera)
        if (v.z > 1) {
          lb.div.style.display = 'none'
          return
        }
        // o'sish davomida yozuvlarni biroz shaffoflashtiramiz
        lb.div.style.opacity = growing ? '0.85' : '1'
        lb.div.style.display = 'flex'
        lb.div.style.left = `${((v.x + 1) / 2) * w}px`
        lb.div.style.top = `${((-v.y + 1) / 2) * h}px`
      })
    }
    animate()

    function onResize() {
      const w = el.clientWidth
      const hgt = el.clientHeight
      camera.aspect = w / hgt
      camera.updateProjectionMatrix()
      renderer.setSize(w, hgt)
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(el)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      dom.removeEventListener('pointerdown', onDown)
      dom.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      dom.removeEventListener('wheel', onWheel)
      meshes.forEach((m) => {
        m.geometry.dispose()
        ;(m.material as THREE.Material).dispose()
      })
      renderer.dispose()
      if (el.contains(dom)) el.removeChild(dom)
      if (el.contains(labelLayer)) el.removeChild(labelLayer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars])

  // Tanlangan ustunni qayta bo'yash (sahnani qayta qurmasdan)
  useEffect(() => {
    highlightRef.current?.()
  }, [selectedId])

  return <div ref={mountRef} className="relative h-full w-full" />
}
