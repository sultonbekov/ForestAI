import type { RegionStats } from '../types'
import type { Lang } from '../i18n'
import { tr, speciesName } from '../i18n'
import { greeneryColor, speciesMeta } from '../data/generateStats'
import RegionChart from './RegionChart'

interface Props {
  stats: RegionStats | null
  lang: Lang
}

function fmt(n: number): string {
  return n.toLocaleString('ru-RU')
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: string
}) {
  return (
    <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-lg font-semibold" style={{ color: accent ?? '#e2e8f0' }}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  )
}

export default function RegionPanel({ stats, lang }: Props) {
  if (!stats) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-slate-500">
        <div>
          <div className="mb-3 text-4xl">🗺️</div>
          <p className="text-sm">{tr('selectRegionHint', lang)}</p>
        </div>
      </div>
    )
  }

  const color = greeneryColor(stats.greeneryPercent)
  const healthyCount = Math.round(stats.treeCount * (stats.healthyPercent / 100))

  return (
    <div className="animate-fade flex flex-col gap-4 p-5">
      <div>
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ background: color }}
          />
          <h2 className="text-xl font-bold text-white">{stats.name}</h2>
        </div>
        <p className="mt-0.5 text-xs text-slate-400">
          {tr('lastSurvey', lang)}: {stats.lastSurveyDate}
        </p>
      </div>

      {/* Katta yashillik ko'rsatkichi */}
      <div
        className="rounded-2xl border p-4"
        style={{
          borderColor: `${color}55`,
          background: `linear-gradient(135deg, ${color}22, transparent)`,
        }}
      >
        <div className="text-xs uppercase tracking-wide text-slate-300">
          {tr('greeneryPercent', lang)}
        </div>
        <div className="mt-1 flex items-end gap-2">
          <span className="text-4xl font-extrabold" style={{ color }}>
            {stats.greeneryPercent}%
          </span>
          <span className="mb-1.5 text-xs text-slate-400">
            NDVI {stats.avgNdvi} · {stats.perCapitaM2} m²/{lang === 'ru' ? 'чел' : 'kishi'}
          </span>
        </div>
      </div>

      {/* Grid ko'rsatkichlar */}
      <div className="grid grid-cols-2 gap-2.5">
        <Stat label={tr('treeCount', lang)} value={fmt(stats.treeCount)} accent="#e2e8f0" />
        <Stat
          label={tr('healthyPercent', lang)}
          value={`${stats.healthyPercent}%`}
          sub={fmt(healthyCount)}
          accent="#4ade80"
        />
        <Stat
          label={tr('atRisk', lang)}
          value={fmt(stats.atRiskCount)}
          accent="#facc15"
        />
        <Stat label={tr('dead', lang)} value={fmt(stats.deadCount)} accent="#f87171" />
      </div>

      {/* Health breakdown bar */}
      <div>
        <div className="mb-1.5 text-xs uppercase tracking-wide text-slate-400">
          {tr('healthBreakdown', lang)}
        </div>
        <div className="flex h-3 overflow-hidden rounded-full">
          <div
            className="bg-emerald-500"
            style={{ width: `${stats.healthyPercent}%` }}
            title={tr('healthy', lang)}
          />
          <div
            className="bg-yellow-400"
            style={{
              width: `${(stats.atRiskCount / stats.treeCount) * 100}%`,
            }}
            title={tr('atRisk', lang)}
          />
          <div
            className="flex-1 bg-red-500"
            title={tr('dead', lang)}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-slate-400">
          <span className="text-emerald-400">● {tr('healthy', lang)}</span>
          <span className="text-yellow-400">● {tr('atRisk', lang)}</span>
          <span className="text-red-400">● {tr('dead', lang)}</span>
        </div>
      </div>

      {/* Daraxt turlari (species) */}
      <div className="rounded-xl bg-slate-800/40 border border-slate-700/50 p-3">
        <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">
          {tr('speciesTitle', lang)}
        </div>

        {/* Stacked bar */}
        <div className="mb-2.5 flex h-3 overflow-hidden rounded-full">
          {stats.species.map((sp) => (
            <div
              key={sp.id}
              style={{ width: `${sp.percent}%`, background: speciesMeta(sp.id).color }}
              title={`${speciesName(sp.id, lang)} — ${sp.percent}%`}
            />
          ))}
        </div>

        {/* Species list */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {stats.species.map((sp) => (
            <div key={sp.id} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: speciesMeta(sp.id).color }}
              />
              <span className="text-sm">{speciesMeta(sp.id).emoji}</span>
              <span className="flex-1 truncate text-xs text-slate-300">
                {speciesName(sp.id, lang)}
              </span>
              <span className="text-xs font-semibold text-slate-200">{sp.percent}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Trend chart */}
      <div className="rounded-xl bg-slate-800/40 border border-slate-700/50 p-3">
        <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">
          {tr('trendTitle', lang)}
        </div>
        <RegionChart data={stats.trend} />
      </div>

      <div className="rounded-xl border border-emerald-700/40 bg-emerald-900/20 px-3 py-2.5">
        <div className="text-[11px] uppercase tracking-wide text-emerald-400/80">
          {tr('newlyPlanted', lang)}
        </div>
        <div className="text-lg font-semibold text-emerald-300">
          +{fmt(stats.newlyPlanted)}
        </div>
      </div>
    </div>
  )
}
