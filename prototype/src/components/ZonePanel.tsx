import type { ZoneStats } from '../types'
import type { Lang } from '../i18n'
import { tr } from '../i18n'
import { CATEGORY_COLORS } from '../data/generateStats'

interface Props {
  zone: ZoneStats
  lang: Lang
  year: number // boshqariladigan yil (xarita bilan sinxron)
  onYearChange: (y: number) => void
  onClose: () => void
}

const fmt = (n: number) => n.toLocaleString('ru-RU')

const CATS = [
  { key: 'healthy', tkey: 'cat_healthy' as const },
  { key: 'atRisk', tkey: 'cat_atRisk' as const },
  { key: 'planted', tkey: 'cat_planted' as const },
  { key: 'dead', tkey: 'cat_dead' as const },
] as const

export default function ZonePanel({ zone, lang, year, onYearChange, onClose }: Props) {
  const yearIdx = Math.max(0, zone.years.findIndex((y) => y.year === year))
  const setYearIdx = (i: number) => onYearChange(zone.years[i].year)
  const yb = zone.years[yearIdx]
  const grandTotal = yb.healthy + yb.atRisk + yb.planted + yb.dead

  return (
    <div className="animate-fade flex h-full flex-col">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-800 px-5 py-4">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-emerald-400/80">
            {tr('mfyZone', lang)}
          </div>
          <h2 className="truncate text-xl font-bold text-white">{zone.name}</h2>
          <p className="truncate text-xs text-slate-400">{zone.districtName}</p>
        </div>
        <button
          onClick={onClose}
          className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700"
          aria-label={tr('close', lang)}
        >
          ✕
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
        {/* Year slider */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-slate-400">
              {tr('yearLabel', lang)}
            </span>
            <span className="text-lg font-bold text-white">{yb.year}</span>
          </div>
          <input
            type="range"
            min={0}
            max={zone.years.length - 1}
            value={yearIdx}
            onChange={(e) => setYearIdx(Number(e.target.value))}
            className="w-full accent-emerald-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            {zone.years.map((y) => (
              <span key={y.year}>{y.year}</span>
            ))}
          </div>
        </div>

        {/* Grand total */}
        <div className="rounded-2xl border border-emerald-700/40 bg-emerald-900/15 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-300">
            {tr('zoneTotal', lang)}
          </div>
          <div className="text-3xl font-extrabold text-emerald-300">{fmt(grandTotal)}</div>
        </div>

        {/* Stacked bar (4 kategoriya) */}
        <div className="flex h-4 overflow-hidden rounded-full">
          {CATS.map((c) => {
            const val = yb[c.key as keyof typeof yb] as number
            return (
              <div
                key={c.key}
                style={{ width: `${(val / grandTotal) * 100}%`, background: CATEGORY_COLORS[c.key] }}
                title={`${tr(c.tkey, lang)}: ${fmt(val)}`}
              />
            )
          })}
        </div>

        {/* Category cards */}
        <div className="grid grid-cols-2 gap-2.5">
          {CATS.map((c) => {
            const val = yb[c.key as keyof typeof yb] as number
            const pct = Math.round((val / grandTotal) * 100)
            return (
              <div
                key={c.key}
                className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-3"
                style={{ borderLeft: `3px solid ${CATEGORY_COLORS[c.key]}` }}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: CATEGORY_COLORS[c.key] }}
                  />
                  <span className="text-[11px] uppercase tracking-wide text-slate-400">
                    {tr(c.tkey, lang)}
                  </span>
                </div>
                <div className="mt-0.5 text-xl font-bold text-white">{fmt(val)}</div>
                <div className="text-[11px] text-slate-500">{pct}%</div>
              </div>
            )
          })}
        </div>

        {/* Yillik dinamika — mini stacked bars */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-3">
          <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">
            {tr('dynamicsByYear', lang)}
          </div>
          <div className="flex items-end justify-between gap-1.5" style={{ height: 90 }}>
            {zone.years.map((y, i) => {
              const t = y.healthy + y.atRisk + y.planted + y.dead
              const maxT = Math.max(
                ...zone.years.map((yy) => yy.healthy + yy.atRisk + yy.planted + yy.dead)
              )
              const hPct = (t / maxT) * 100
              return (
                <button
                  key={y.year}
                  onClick={() => setYearIdx(i)}
                  className="group flex flex-1 flex-col items-center justify-end gap-1"
                  style={{ height: '100%' }}
                >
                  <div
                    className={`flex w-full flex-col overflow-hidden rounded-t transition ${
                      i === yearIdx ? 'ring-2 ring-white/70' : 'opacity-80 group-hover:opacity-100'
                    }`}
                    style={{ height: `${hPct}%` }}
                  >
                    {(['healthy', 'atRisk', 'planted', 'dead'] as const).map((k) => (
                      <div
                        key={k}
                        style={{ height: `${(y[k] / t) * 100}%`, background: CATEGORY_COLORS[k] }}
                      />
                    ))}
                  </div>
                  <span
                    className={`text-[9px] ${
                      i === yearIdx ? 'font-bold text-white' : 'text-slate-500'
                    }`}
                  >
                    {String(y.year).slice(2)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
