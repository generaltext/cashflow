import { useMemo } from 'react'
import { formatCurrency } from '~/lib/date'
import { colorForIndex, mergeVisibleScheduled, type ScenarioData } from '~/lib/forecast'
import type { Scenario } from '~/lib/model'

// The flat, date-sorted schedule across visible scenarios, plus each visible
// scenario's projected ending balance. Capped at 1000 rows (a generous horizon);
// the cap is noted so a truncated list never reads as complete.
export default function ScheduleTable({
  perScenario,
  scenarios,
}: {
  perScenario: ScenarioData[]
  scenarios: Scenario[]
}) {
  const rows = useMemo(() => mergeVisibleScheduled(perScenario), [perScenario])
  const shown = rows.slice(0, 1000)
  const colorOf = (id: string) => colorForIndex(Math.max(0, scenarios.findIndex((s) => s.id === id)))

  const endings = perScenario.filter((d) => d.scenario.visible)

  return (
    <div className="flex flex-col lg:min-h-0 lg:flex-1">
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
        {endings.map((d) => (
          <span key={d.scenario.id} className="inline-flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorOf(d.scenario.id) }} />
            {d.scenario.name}:{' '}
            <span className="font-medium tabular-nums text-neutral-800 dark:text-neutral-200">
              {formatCurrency(d.scheduled[d.scheduled.length - 1]?.balance ?? d.scenario.opening)}
            </span>
          </span>
        ))}
        {endings.length === 0 && <span className="text-xs text-neutral-500">No visible scenarios.</span>}
      </div>

      <div className="overflow-x-auto border-t border-neutral-200 lg:min-h-0 lg:flex-1 lg:overflow-y-auto dark:border-neutral-800">
        <table className="w-full min-w-[34rem] text-sm">
          <thead className="sticky top-0 bg-neutral-100 text-left text-xs text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
            <tr>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Scenario</th>
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
              <th className="px-3 py-2 text-right font-medium">Balance</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r, idx) => (
              <tr key={idx} className="border-t border-neutral-200 dark:border-neutral-800/70">
                <td className="whitespace-nowrap px-3 py-1.5 tabular-nums text-neutral-600 dark:text-neutral-300">{r.dateStr}</td>
                <td className="whitespace-nowrap px-3 py-1.5">
                  <span className="inline-flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
                    <span className="h-2 w-2 rounded-full" style={{ background: colorOf(r.scenarioId) }} />
                    {r.scenarioName}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-neutral-700 dark:text-neutral-200">{r.name}</td>
                <td
                  className={`px-3 py-1.5 text-right tabular-nums ${
                    r.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {formatCurrency(r.amount)}
                </td>
                <td
                  className={`px-3 py-1.5 text-right tabular-nums ${
                    r.balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-neutral-800 dark:text-neutral-200'
                  }`}
                >
                  {formatCurrency(r.balance)}
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-neutral-500">
                  No upcoming transactions in this window.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > shown.length && (
        <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-600">
          Showing first {shown.length.toLocaleString()} of {rows.length.toLocaleString()} transactions.
        </p>
      )}
    </div>
  )
}
