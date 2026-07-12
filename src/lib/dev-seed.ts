// dev-seed.ts — the sample document a brand-new, empty workspace starts with:
// standalone `pnpm dev` and the gallery "Try it live" demo. Written once (see
// maybeSeed in use-cashflow) only when the data file is absent; entirely inert
// under a real General Text host. Deliberately generic placeholder figures — no
// real financial data ships in the repo.

import { addDays, addMonths, toISODate } from '~/lib/date'
import { ensureMonthlyStartDates, uid, type CashflowDoc, type Item } from '~/lib/model'

export function buildSeedDoc(): CashflowDoc {
  const today = new Date()
  const start = toISODate(today)

  const baselineItems: Item[] = [
    { id: uid(), name: 'Paycheck', amount: 3500, kind: 'biweekly', anchorDate: toISODate(addDays(today, -7)), enabled: true },
    { id: uid(), name: 'Mortgage', amount: -2800, kind: 'monthly', dayOfMonth: 15, enabled: true },
    { id: uid(), name: 'Groceries', amount: -250, kind: 'weekly', anchorDate: start, enabled: true },
    { id: uid(), name: 'Property tax', amount: -4800, kind: 'once', date: toISODate(addMonths(today, 4)), enabled: true },
  ]

  const optimisticItems: Item[] = [
    ...baselineItems.map((it) => ({ ...it, id: uid() })),
    { id: uid(), name: 'Freelance project', amount: 1200, kind: 'monthly', dayOfMonth: 1, enabled: true },
  ]

  const scenarios = ensureMonthlyStartDates([
    {
      id: uid(),
      name: 'Baseline',
      visible: true,
      opening: 25000,
      start,
      months: 12,
      openingDate: start,
      items: baselineItems,
    },
    {
      id: uid(),
      name: 'With side income',
      visible: true,
      opening: 25000,
      start,
      months: 12,
      openingDate: start,
      items: optimisticItems,
    },
  ])

  return { version: 1, globalStart: start, globalMonths: 12, scenarios }
}
