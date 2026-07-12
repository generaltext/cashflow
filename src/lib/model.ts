// model.ts — the Cashflow data model and the (de)serialization + import logic.
//
// The whole app state is one synced JSON file in the app's data folder,
// `v0/cashflow.json`: a single document holding the global timeline and every
// scenario. That mirrors the export format the v1 app produced, so a file
// exported from v1 imports here losslessly and vice-versa. Paths are RELATIVE to
// the app's data folder (the runtime maps `v0/...` to wherever the app is
// installed) — never hardcode `_gtApps/cashflow/...`.

import { parseDateInput, toISODate } from '~/lib/date'

export const DATA_DIR = 'v0' // our format major; bump + migrate on a breaking change
export const DATA_PATH = `${DATA_DIR}/cashflow.json`

// Light/dark is no longer the app's to persist: the shell owns the theme and the
// runtime applies it (see use-theme.ts). Standalone/demo gets a local toggle only.

export type Kind = 'once' | 'weekly' | 'biweekly' | 'monthly' | 'meta'

/** A recurring or one-off cashflow line. `amount` may be a string in imported
 *  data (the v1 app stored some as strings); the forecast engine coerces with
 *  Number(). We keep whatever was stored so import/export round-trips exactly. */
export type Item = {
  id: string
  name: string
  amount: number | string
  kind: Kind
  enabled?: boolean
  date?: string // 'once'
  anchorDate?: string // 'weekly' | 'biweekly'
  dayOfMonth?: number // 'monthly'
  monthStartDate?: string // 'monthly' — first month the rule applies
  endDate?: string // optional cutoff for any recurring/one-off
}

export type Scenario = {
  id: string
  name: string
  visible: boolean
  opening: number
  start: string
  months: number
  openingDate?: string
  items: Item[]
}

export type CashflowDoc = {
  version: 1
  globalStart: string
  globalMonths: number
  scenarios: Scenario[]
}

/** UUID without a dependency — built into every modern browser. */
export function uid(): string {
  return crypto.randomUUID()
}

// --- Serialization -------------------------------------------------------------

/** The text written to `v0/cashflow.json`. Pretty-printed so the file stays
 *  human-readable and diffs cleanly (the runtime applies a minimal CRDT diff). */
export function serializeDoc(doc: CashflowDoc): string {
  return JSON.stringify(doc, null, 2) + '\n'
}

/** Parse the stored file. Returns null for empty/invalid content so callers can
 *  decide whether to seed. Tolerant: missing fields fall back to sane defaults
 *  and items/scenarios are normalized the way the v1 app normalized them. */
export function parseDoc(text: string): CashflowDoc | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  let raw: unknown
  try {
    raw = JSON.parse(trimmed)
  } catch {
    return null
  }
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { scenarios?: unknown }).scenarios)) {
    return null
  }
  const obj = raw as { globalStart?: unknown; globalMonths?: unknown; scenarios: unknown[] }
  const today = toISODate(new Date())
  const globalStart = typeof obj.globalStart === 'string' ? obj.globalStart : today
  const globalMonths = Number(obj.globalMonths) || 12
  const scenarios = ensureMonthlyStartDates(obj.scenarios.map((sc) => normalizeScenario(sc, globalStart, globalMonths)))
  return { version: 1, globalStart, globalMonths, scenarios }
}

// --- Normalization (mirrors the v1 app) ---------------------------------------

function normalizeItem(raw: unknown): Item {
  const o = (raw ?? {}) as Record<string, unknown>
  const item: Item = {
    id: o.id != null ? String(o.id) : uid(),
    name: o.name != null ? String(o.name) : 'Untitled',
    amount: typeof o.amount === 'string' ? o.amount : Number(o.amount ?? 0),
    kind: (o.kind as Kind) ?? 'monthly',
    enabled: o.enabled !== false,
  }
  if (o.date != null) item.date = String(o.date)
  if (o.anchorDate != null) item.anchorDate = String(o.anchorDate)
  if (o.dayOfMonth != null) item.dayOfMonth = Number(o.dayOfMonth)
  if (o.monthStartDate != null) item.monthStartDate = String(o.monthStartDate)
  if (o.endDate != null) item.endDate = String(o.endDate)
  return item
}

function normalizeScenario(raw: unknown, fallbackStart: string, fallbackMonths: number): Scenario {
  const o = (raw ?? {}) as Record<string, unknown>
  const start = o.start != null ? String(o.start) : fallbackStart
  return {
    id: o.id != null ? String(o.id) : uid(),
    name: o.name != null ? String(o.name) : 'Scenario',
    visible: o.visible !== false,
    opening: Number(o.opening ?? 0),
    start,
    months: Number(o.months ?? fallbackMonths),
    openingDate: o.openingDate != null ? String(o.openingDate) : start,
    items: Array.isArray(o.items) ? o.items.map(normalizeItem) : [],
  }
}

/** Monthly items get an anchored `monthStartDate` (derived from the scenario's
 *  opening date) if they don't already have one — same rule the v1 app used. */
export function ensureMonthlyStartDates(scenarios: Scenario[]): Scenario[] {
  return scenarios.map((sc) => {
    const ref = parseDateInput(sc.openingDate || sc.start) || new Date()
    const y = ref.getFullYear()
    const m = ref.getMonth()
    const items = sc.items.map((it) => {
      if (it.kind === 'monthly' && !it.monthStartDate) {
        const d = Number(it.dayOfMonth) || 1
        return { ...it, monthStartDate: toISODate(new Date(y, m, d)) }
      }
      return it
    })
    return { ...sc, items }
  })
}

// --- Import (accepts every format the v1 app accepted) ------------------------

export type ImportResult = { doc: CashflowDoc; message: string }

/** Merge an uploaded JSON payload into the current doc, appending scenarios.
 *  Recognizes, in order: the canonical `{ globalStart?, globalMonths?, scenarios }`
 *  export; a legacy single-config `{ items, opening?, start?, months? }`; a legacy
 *  localStorage dump (`cashflow_items`, …); and a bare array of items. Throws on
 *  unrecognized input so the caller can surface an error. */
export function importInto(current: CashflowDoc, text: string): ImportResult {
  const data: unknown = JSON.parse(text) // may throw — caller handles

  // Canonical export: { globalStart?, globalMonths?, scenarios: Scenario[] }
  if (isObject(data) && Array.isArray(data.scenarios)) {
    const imported = data.scenarios.map((sc) => normalizeScenario(sc, current.globalStart, current.globalMonths))
    const next: CashflowDoc = {
      version: 1,
      globalStart: typeof data.globalStart === 'string' ? data.globalStart : current.globalStart,
      globalMonths: data.globalMonths != null ? Number(data.globalMonths) : current.globalMonths,
      scenarios: ensureMonthlyStartDates([...current.scenarios, ...imported]),
    }
    return { doc: next, message: `Imported ${imported.length} scenario(s).` }
  }

  // Legacy single-config: { items, opening?, start?, months? }
  if (isObject(data) && Array.isArray(data.items)) {
    return appendLegacy(current, data, 'Imported 1 scenario from legacy format.')
  }

  // Legacy localStorage dump: { cashflow_items, cashflow_opening, ... }
  if (
    isObject(data) &&
    (data.cashflow_items || data.cashflow_opening || data.cashflow_start || data.cashflow_months)
  ) {
    const legacy = {
      items: Array.isArray(data.cashflow_items) ? data.cashflow_items : [],
      opening: Number(data.cashflow_opening ?? 0),
      start: String(data.cashflow_start ?? current.globalStart),
      months: Number(data.cashflow_months ?? current.globalMonths),
      name: 'Imported (legacy dump)',
    }
    return appendLegacy(current, legacy, 'Imported 1 scenario from legacy localStorage dump.')
  }

  // Bare array → treat as items.
  if (Array.isArray(data)) {
    return appendLegacy(current, { items: data }, 'Imported 1 scenario from items array.')
  }

  throw new Error('Unrecognized JSON format.')
}

function appendLegacy(current: CashflowDoc, obj: Record<string, unknown>, message: string): ImportResult {
  const itemsArr = Array.isArray(obj.items) ? obj.items : []
  const start = String(obj.start ?? current.globalStart)
  const scenario: Scenario = {
    id: uid(),
    name: obj.name != null ? String(obj.name) : 'Imported Scenario',
    visible: true,
    opening: Number(obj.opening ?? 0),
    start,
    months: Number(obj.months ?? current.globalMonths),
    openingDate: obj.openingDate != null ? String(obj.openingDate) : start,
    items: itemsArr.map(normalizeItem),
  }
  return {
    doc: { ...current, scenarios: ensureMonthlyStartDates([...current.scenarios, scenario]) },
    message,
  }
}

/** What `exportDoc` downloads: the canonical v1-interchangeable shape (no internal
 *  `version` field) so files move freely between this app and the old one. */
export function exportPayload(doc: CashflowDoc): string {
  const { globalStart, globalMonths, scenarios } = doc
  return JSON.stringify({ globalStart, globalMonths, scenarios }, null, 2)
}

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}
