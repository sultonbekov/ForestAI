import type { Lang } from '../i18n'
import { tr } from '../i18n'

interface Props {
  lang: Lang
  totalTrees: number
  avgGreenery: number
  districts: number
}

function Card({
  value,
  label,
  accent,
}: {
  value: string
  label: string
  accent: string
}) {
  return (
    <div className="min-w-[104px] shrink-0 rounded-xl border border-slate-700/50 bg-slate-800/40 px-3 py-2 sm:min-w-0">
      <div className="text-base font-bold sm:text-xl" style={{ color: accent }}>
        {value}
      </div>
      <div className="text-[10px] leading-tight text-slate-400 sm:text-[11px]">{label}</div>
    </div>
  )
}

export default function StatsSummary({ lang, totalTrees, avgGreenery, districts }: Props) {
  const trees =
    totalTrees >= 1_000_000
      ? `${(totalTrees / 1_000_000).toFixed(1)} mln`
      : `${Math.round(totalTrees / 1000)}k`

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:gap-2.5 sm:overflow-visible sm:pb-0 lg:grid-cols-6">
      <Card value="30%" label={tr('target2030', lang)} accent="#4ade80" />
      <Card
        value={`${avgGreenery}%`}
        label={tr('currentGreenery', lang)}
        accent="#facc15"
      />
      <Card value="9–10 m²" label={tr('perCapita', lang)} accent="#38bdf8" />
      <Card value="−25%" label={tr('pmReduction', lang)} accent="#a78bfa" />
      <Card value={String(districts)} label={tr('districtsCount', lang)} accent="#e2e8f0" />
      <Card value={trees} label={tr('totalTrees', lang)} accent="#34d399" />
    </div>
  )
}
