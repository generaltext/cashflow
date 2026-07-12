// forecast.ts — the pure projection engine, ported verbatim from the v1 app.
//
// Given a scenario's items and the global timeline, it expands recurring/one-off
// items into dated events, accumulates a running balance, and merges visible
// scenarios into chart rows and a flat schedule table. No React, no I/O — just
// math over the model, so it's trivially testable and reused across views.

import { addDays, addMonths, parseDateInput, startOfDay, toISODate } from '~/lib/date'
import type { Item, Scenario } from '~/lib/model'

export type EventRow = { date: Date; name: string; amount: number }
export type AccRow = EventRow & { balance: number; dateStr: string }
export type SeriesPoint = { dateStr: string; balance: number }
export type ScenarioData = { scenario: Scenario; scheduled: AccRow[]; series: SeriesPoint[] }
export type ScheduleRow = AccRow & { scenarioName: string; scenarioId: string }

/** The next date on or after `fromDate` that lands on `dayOfMonth`. */
function nextOnOrAfter(dayOfMonth: number, fromDate: Date): Date {
  const year = fromDate.getFullYear()
  const month = fromDate.getMonth()
  const candidate = new Date(year, month, dayOfMonth) // Date overflow clamps long months
  if (candidate >= startOfDay(fromDate)) return candidate
  return new Date(year, month + 1, dayOfMonth)
}

/** Expand a scenario's items into dated events within [startDate, startDate+months). */
export function generateEvents({
  items,
  startDate,
  months,
}: {
  items: Item[]
  startDate: Date
  months: number
}): EventRow[] {
  const horizonEnd = startOfDay(addMonths(startDate, months))
  const events: EventRow[] = []

  for (const it of items) {
    if (!it || it.kind === 'meta' || it.enabled === false) continue
    const amt = Number(it.amount) || 0
    if (amt === 0) continue

    if (it.kind === 'once') {
      const dt = parseDateInput(it.date)
      const userEnd = parseDateInput(it.endDate)
      if (dt && dt >= startDate && dt < horizonEnd && (!userEnd || dt <= userEnd)) {
        events.push({ date: startOfDay(dt), name: it.name, amount: amt })
      }
      continue
    }

    if (it.kind === 'weekly' || it.kind === 'biweekly') {
      const step = it.kind === 'weekly' ? 7 : 14
      let d0 = parseDateInput(it.anchorDate)
      if (!d0) continue
      d0 = startOfDay(d0)
      // Advance to the first occurrence on/after startDate.
      if (d0 < startDate) {
        const diffDays = Math.floor((startDate.getTime() - d0.getTime()) / (24 * 3600 * 1000))
        const k = Math.ceil(diffDays / step)
        d0 = addDays(d0, k * step)
      }
      const userEnd = parseDateInput(it.endDate)
      const endLimit = userEnd ? startOfDay(addDays(userEnd, 1)) : horizonEnd
      for (let d = d0; d < endLimit; d = addDays(d, step)) {
        events.push({ date: startOfDay(d), name: it.name, amount: amt })
      }
      continue
    }

    if (it.kind === 'monthly') {
      const day = it.monthStartDate ? parseDateInput(it.monthStartDate)?.getDate() || 1 : Number(it.dayOfMonth) || 1
      const itemStart = it.monthStartDate ? parseDateInput(it.monthStartDate) || startDate : startDate
      const lowerBound = itemStart > startDate ? itemStart : startDate
      const d0 = nextOnOrAfter(day, lowerBound)
      const userEnd = parseDateInput(it.endDate)
      const endLimit = userEnd ? startOfDay(addDays(userEnd, 1)) : horizonEnd
      for (let d = d0; d < endLimit; d = addMonths(d, 1)) {
        events.push({ date: startOfDay(d), name: it.name, amount: amt })
      }
      continue
    }
  }

  events.sort((a, b) => a.date.getTime() - b.date.getTime() || a.name.localeCompare(b.name))
  return events
}

function accumulate(events: EventRow[], opening: number): AccRow[] {
  let bal = Number(opening) || 0
  return events.map((e) => {
    bal += e.amount
    return { ...e, balance: bal, dateStr: toISODate(e.date) }
  })
}

/** Per-scenario schedule + balance series over the global timeline. A scenario's
 *  opening balance applies on its opening date (if later than the global start),
 *  filtering out earlier events; otherwise it applies at the global start. */
export function buildScenarioData(scenarios: Scenario[], globalStart: string, globalMonths: number): ScenarioData[] {
  const startDate = parseDateInput(globalStart) || new Date()
  const horizonEnd = startOfDay(addMonths(startDate, globalMonths))
  return scenarios.map((sc) => {
    const evs = generateEvents({ items: sc.items, startDate, months: globalMonths })
    const openingDt = parseDateInput(sc.openingDate || globalStart)
    let acc: AccRow[]
    if (openingDt && openingDt > startDate && openingDt < horizonEnd) {
      const filtered = evs.filter((e) => e.date >= openingDt)
      acc = accumulate([{ date: openingDt, name: 'Opening Balance', amount: sc.opening }, ...filtered], 0)
    } else {
      acc = accumulate(evs, sc.opening)
    }
    const startPoint: SeriesPoint = { dateStr: toISODate(startDate), balance: acc[0]?.balance ?? sc.opening }
    const series = [startPoint, ...acc.map((e) => ({ dateStr: e.dateStr, balance: e.balance }))]
    return { scenario: sc, scheduled: acc, series }
  })
}

/** Union chart rows across visible scenarios: one row per distinct date, each
 *  carrying every visible scenario's balance carried forward (`balance_<id>`). */
export function buildChartData(perScenario: ScenarioData[]): Record<string, string | number>[] {
  const visible = perScenario.filter((d) => d.scenario.visible)
  if (!visible.length) return []

  const allDates = [...new Set(visible.flatMap((d) => d.series.map((p) => p.dateStr)))].sort()
  const indexByScenario = new Map<string, number>()
  visible.forEach((d) => indexByScenario.set(d.scenario.id, 0))

  return allDates.map((dateStr) => {
    const row: Record<string, string | number> = { date: dateStr }
    for (const d of visible) {
      const id = d.scenario.id
      let idx = indexByScenario.get(id) ?? 0
      while (idx + 1 < d.series.length && d.series[idx + 1]!.dateStr <= dateStr) idx += 1
      indexByScenario.set(id, idx)
      row[`balance_${id}`] = d.series[idx]?.balance ?? d.scenario.opening
    }
    return row
  })
}

/** Flat, date-sorted schedule across visible scenarios for the table view. */
export function mergeVisibleScheduled(perScenario: ScenarioData[]): ScheduleRow[] {
  const rows: ScheduleRow[] = []
  for (const d of perScenario) {
    if (!d.scenario.visible) continue
    for (const r of d.scheduled) rows.push({ ...r, scenarioName: d.scenario.name, scenarioId: d.scenario.id })
  }
  rows.sort((a, b) => a.date.getTime() - b.date.getTime() || a.scenarioName.localeCompare(b.scenarioName))
  return rows
}

// The original (v1) chart palette — d3/tableau "category10". A calmer, more
// muted set than bright Tailwind hues. Each scenario takes its color by index in
// the doc, independent of visibility, so toggling one doesn't recolor the others.
const PALETTE = [
  '#1f77b4', // blue
  '#ff7f0e', // orange
  '#2ca02c', // green
  '#d62728', // red
  '#9467bd', // purple
  '#8c564b', // brown
  '#e377c2', // pink
  '#7f7f7f', // gray
  '#bcbd22', // olive
  '#17becf', // teal
]

export function colorForIndex(idx: number): string {
  return PALETTE[((idx % PALETTE.length) + PALETTE.length) % PALETTE.length]!
}
