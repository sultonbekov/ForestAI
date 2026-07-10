import type {
  RegionStats,
  TrendPoint,
  SpeciesId,
  SpeciesShare,
  ZoneStats,
  YearBreakdown,
} from '../types'

// Bargli daraxt turlari (rasmga mos + chinor)
export const SPECIES: { id: SpeciesId; color: string; emoji: string }[] = [
  { id: 'chinor', color: '#3f9142', emoji: '🌳' },
  { id: 'dub', color: '#6b8e23', emoji: '🌰' },
  { id: 'klen', color: '#e2711d', emoji: '🍁' },
  { id: 'bereza', color: '#8bc34a', emoji: '🌲' },
  { id: 'osina', color: '#c0392b', emoji: '🍂' },
  { id: 'iva', color: '#2e8b57', emoji: '🌿' },
  { id: 'kashtan', color: '#7cb342', emoji: '🌰' },
  { id: 'ryabina', color: '#d84315', emoji: '🍒' },
]

export const speciesMeta = (id: SpeciesId) => SPECIES.find((s) => s.id === id)!

// Barqaror (deterministik) pseudo-random generator — sahifa yangilanganda
// raqamlar o'zgarmasligi uchun. Har bir hudud nomidan seed olinadi.
function hashString(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round = (n: number, d = 0) => {
  const f = 10 ** d
  return Math.round(n * f) / f
}

// PF-47 Farmon konteksti: milliy o'rtacha ~14.2%, maqsad 30% (2030).
// Hududlar shu o'rtacha atrofida real ko'rinishdagi tarqoqlik bilan.
export function generateStats(id: string, name: string): RegionStats {
  const rand = mulberry32(hashString(name))

  const greeneryPercent = round(8 + rand() * 20, 1) // 8..28%
  const treeCount = Math.round(30_000 + rand() * 420_000) // ~30k..450k
  const healthyPercent = round(68 + rand() * 27, 1) // 68..95%
  const atRiskCount = Math.round(treeCount * (1 - healthyPercent / 100) * (0.5 + rand() * 0.4))
  const deadCount = Math.round(treeCount * (1 - healthyPercent / 100) * (0.1 + rand() * 0.25))
  const newlyPlanted = Math.round(treeCount * (0.04 + rand() * 0.09))
  const avgNdvi = round(0.45 + (greeneryPercent / 28) * 0.4 + rand() * 0.05, 2)
  const perCapitaM2 = round(4 + rand() * 8, 1) // 4..12 m2

  // 2021..2026 dinamika: o'sish tendensiyasi (Farmon maqsadi sari)
  const trend: TrendPoint[] = []
  const start = greeneryPercent - (2.5 + rand() * 4)
  for (let i = 0; i <= 5; i++) {
    const year = 2021 + i
    const t = i / 5
    const noise = (rand() - 0.5) * 1.2
    trend.push({
      year,
      greeneryPercent: round(Math.max(4, start + (greeneryPercent - start) * t + noise), 1),
    })
  }
  // oxirgi nuqta aynan hozirgi qiymatga teng bo'lsin
  trend[trend.length - 1].greeneryPercent = greeneryPercent

  const months = ['yanvar', 'mart', 'aprel', 'may', 'sentabr', 'oktabr']
  const lastSurveyDate = `2026-yil, ${months[Math.floor(rand() * months.length)]}`

  // Daraxt turlari taqsimoti — har turga tasodifiy vazn, keyin normallash
  const weights = SPECIES.map((s) => {
    // chinor va dub biroz ustunroq (mahalliy keng tarqalgan)
    const base = s.id === 'chinor' ? 1.6 : s.id === 'dub' ? 1.3 : 1
    return base * (0.3 + rand())
  })
  const wSum = weights.reduce((a, b) => a + b, 0)
  const species: SpeciesShare[] = SPECIES.map((s, i) => {
    const pct = (weights[i] / wSum) * 100
    return {
      id: s.id,
      percent: round(pct, 1),
      count: Math.round(treeCount * (pct / 100)),
    }
  }).sort((a, b) => b.percent - a.percent)

  return {
    id,
    name,
    greeneryPercent,
    treeCount,
    healthyPercent,
    atRiskCount,
    deadCount,
    newlyPlanted,
    avgNdvi,
    perCapitaM2,
    lastSurveyDate,
    trend,
    species,
  }
}

// Yashillik foiziga qarab rang (qizil -> sariq -> yashil)
export function greeneryColor(pct: number): string {
  // 8% -> qizil, 18% -> sariq, 28%+ -> to'q yashil
  const stops: [number, [number, number, number]][] = [
    [8, [220, 38, 38]], // red-600
    [14, [234, 179, 8]], // yellow-500
    [20, [132, 204, 22]], // lime-500
    [28, [21, 128, 61]], // forest-700
  ]
  const p = Math.max(stops[0][0], Math.min(stops[stops.length - 1][0], pct))
  for (let i = 0; i < stops.length - 1; i++) {
    const [a, ca] = stops[i]
    const [b, cb] = stops[i + 1]
    if (p >= a && p <= b) {
      const t = (p - a) / (b - a)
      const c = ca.map((v, k) => Math.round(v + (cb[k] - v) * t))
      return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
    }
  }
  return `rgb(21, 128, 61)`
}

// Daraxt holati kategoriyalari uchun ranglar
export const CATEGORY_COLORS: Record<string, string> = {
  healthy: '#22c55e', // sog'lom — yashil
  atRisk: '#facc15', // xavf ostida — sariq
  dead: '#ef4444', // nobud — qizil
  planted: '#38bdf8', // ekilgan — ko'k
}

// MFY zonasi uchun yillik daraxt kategoriyalari (2021..2026).
// "Yashil makon" dasturi: har yili yangi ekilgan daraxtlar qo'shiladi,
// sog'lom soni o'sadi, ba'zilari xavf ostida yoki nobud bo'ladi.
export function generateZoneStats(id: string, name: string, districtName: string): ZoneStats {
  const rand = mulberry32(hashString(name))

  // Zona "profili" — har xil zonalar har xil holatda bo'lsin (rang xilma-xilligi uchun)
  // 0..1: 0.55 sog'lom, 0.2 xavf, 0.13 ekilgan (yosh), 0.12 muammoli
  const p = rand()
  const profile =
    p < 0.55 ? 'healthy' : p < 0.75 ? 'atRisk' : p < 0.88 ? 'planted' : 'dead'

  let healthy = Math.round(1200 + rand() * 6000)
  const years: YearBreakdown[] = []

  for (let y = 2021; y <= 2026; y++) {
    // Ekilgan — "planted" profilida ko'proq (yangi mahalla)
    const plantMul = profile === 'planted' ? 2.4 : 1
    const planted = Math.round(300 + rand() * 1800 * (1 + (y - 2021) * 0.12) * plantMul)
    // Xavf ostida — "atRisk" profilida ko'proq
    const riskMul = profile === 'atRisk' ? 3.2 : 1
    const atRisk = Math.round(healthy * (0.06 + rand() * 0.1) * riskMul)
    // Nobud — "dead" profilida ko'proq
    const deadMul = profile === 'dead' ? 4 : 1
    const dead = Math.round(healthy * (0.02 + rand() * 0.05) * deadMul)
    const total = healthy + atRisk + planted

    years.push({ year: y, healthy, atRisk, dead, planted, total })

    healthy = Math.round(healthy + planted * (0.75 + rand() * 0.15) + atRisk * 0.4 - dead * 0.5)
  }

  return { id, name, districtName, years }
}
