import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import type { TrendPoint } from '../types'

export default function RegionChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <AreaChart data={data} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="greenFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#22c55e" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
        <XAxis
          dataKey="year"
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          axisLine={{ stroke: 'rgba(148,163,184,0.2)' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={34}
          unit="%"
        />
        <Tooltip
          contentStyle={{
            background: 'rgba(15,23,42,0.95)',
            border: '1px solid rgba(34,197,94,0.4)',
            borderRadius: 8,
            color: '#e2e8f0',
            fontSize: 12,
          }}
          formatter={(v: number) => [`${v}%`, 'Yashillik']}
        />
        <Area
          type="monotone"
          dataKey="greeneryPercent"
          stroke="#22c55e"
          strokeWidth={2}
          fill="url(#greenFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
