// date.ts — small date helpers shared by the model, the forecast engine, and the
// UI. Dates are handled as local-time `YYYY-MM-DD` strings (the format the date
// inputs and the stored file use); `toISODate` formats in local time so a date
// never drifts a day across a timezone offset.

export function toISODate(d: Date): string {
  const tzOffset = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10)
}

export function parseDateInput(v: string | null | undefined): Date | null {
  if (!v) return null
  const d = new Date(v)
  return isNaN(+d) ? null : d
}

export function addDays(d: Date, n: number): Date {
  const nd = new Date(d)
  nd.setDate(nd.getDate() + n)
  return nd
}

export function addMonths(d: Date, n: number): Date {
  const nd = new Date(d)
  nd.setMonth(nd.getMonth() + n)
  return nd
}

export function startOfDay(d: Date): Date {
  const nd = new Date(d)
  nd.setHours(0, 0, 0, 0)
  return nd
}

export function formatCurrency(n: number): string {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}
