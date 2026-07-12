import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCurrency } from '~/lib/date'
import { colorForIndex } from '~/lib/forecast'
import type { Scenario } from '~/lib/model'

// The projected-balance chart: one tinted area per visible scenario, overlaid on a
// shared timeline. Colors come from each scenario's index in the doc (stable
// regardless of visibility), so toggling one never recolors the others.
export default function Chart({
  scenarios,
  chartData,
  dark,
}: {
  scenarios: Scenario[]
  chartData: Record<string, string | number>[]
  dark: boolean
}) {
  const colorOf = (id: string) => colorForIndex(Math.max(0, scenarios.findIndex((s) => s.id === id)))

  // Chart chrome (grid/axes/tooltip) is SVG, not DOM, so it can't use `dark:`
  // utilities — pick its colors from the theme directly.
  const grid = dark ? '#3f3f46' : '#e5e5e5'
  const axis = dark ? '#52525b' : '#d4d4d4'
  const tick = dark ? '#a1a1aa' : '#71717a'
  const tooltipBg = dark ? '#18181b' : '#ffffff'
  const tooltipBorder = dark ? '#3f3f46' : '#e5e5e5'
  const tooltipLabel = dark ? '#e4e4e7' : '#27272a'

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
        <defs>
          {scenarios.map((sc) => (
            <linearGradient key={sc.id} id={`g-${sc.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colorOf(sc.id)} stopOpacity={0.35} />
              <stop offset="100%" stopColor={colorOf(sc.id)} stopOpacity={0.04} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={grid} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: tick }} minTickGap={28} stroke={axis} />
        <YAxis
          tick={{ fontSize: 11, fill: tick }}
          tickFormatter={(v) => (typeof v === 'number' ? compactCurrency(v) : v)}
          width={68}
          stroke={axis}
        />
        <Tooltip
          contentStyle={{
            background: tooltipBg,
            border: `1px solid ${tooltipBorder}`,
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: tooltipLabel }}
          formatter={(v) => (typeof v === 'number' ? formatCurrency(v) : v)}
          labelFormatter={(l) => `Date: ${l}`}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {scenarios
          .filter((sc) => sc.visible)
          .map((sc) => (
            <Area
              key={sc.id}
              type="monotone"
              name={sc.name}
              dataKey={`balance_${sc.id}`}
              stroke={colorOf(sc.id)}
              strokeWidth={2}
              fill={`url(#g-${sc.id})`}
              dot={false}
              isAnimationActive={false}
            />
          ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}

/** Compact axis labels: $25k, -$1.2k, $0. */
function compactCurrency(v: number): string {
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`
  return `${sign}$${abs.toFixed(0)}`
}
