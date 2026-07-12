// use-cashflow.ts — the app's data layer. The entire model lives in one synced
// file, `v0/cashflow.json`; this hook owns its single subscribe/observe lifecycle,
// parses it into a `CashflowDoc`, and exposes actions that mutate by writing the
// whole next document back (the runtime applies a minimal CRDT diff). Talks to
// General Text only through the platform-injected `window.gt` — no bundled client,
// no yjs.

import { useEffect, useMemo, useRef, useState } from 'react'
import { toISODate } from '~/lib/date'
import { buildSeedDoc } from '~/lib/dev-seed'
import {
  DATA_PATH,
  ensureMonthlyStartDates,
  importInto,
  parseDoc,
  serializeDoc,
  uid,
  type CashflowDoc,
  type Item,
  type Scenario,
} from '~/lib/model'

function emptyDoc(): CashflowDoc {
  const start = toISODate(new Date())
  return { version: 1, globalStart: start, globalMonths: 12, scenarios: [] }
}

/** Seed sample scenarios into an empty, throwaway workspace so the app never opens
 *  blank: standalone `pnpm dev` and the gallery "Try it live" demo. Keys off
 *  `gt.mode === 'demo'` (runtime 1.3+) and falls back to `gt.sync.isLocal`. Inert
 *  in a real workspace, and only ever seeds when it's empty. */
async function maybeSeed() {
  const gt = window.gt
  if (gt.mode !== 'demo' && !gt.sync.isLocal) return
  // Gate on the data file specifically (not "any file"): the separate settings
  // file must never suppress seeding, and a user who emptied their scenarios in a
  // demo keeps that empty state rather than getting reseeded.
  const files = await gt.listFiles()
  if (files.some((f) => f.path === DATA_PATH && f.sizeBytes > 0)) return
  await gt.writeFile(DATA_PATH, serializeDoc(buildSeedDoc())).catch(() => {})
}

export function useCashflow() {
  const gt = window.gt
  const [connected, setConnected] = useState(false)
  const [docText, setDocText] = useState('')
  const textRef = useRef<GtText | null>(null)

  // --- Connection ---
  // window.gt connects itself; we just await `ready` and observe state. No
  // disconnect — the platform owns the runtime's lifecycle.
  useEffect(() => {
    gt.ready.then(() => setConnected(true)).catch(() => {})
    void maybeSeed()
    const unsubs = [
      gt.on('connected', () => setConnected(true)),
      gt.on('disconnected', () => setConnected(false)),
    ]
    return () => unsubs.forEach((fn) => fn())
  }, [gt])

  // --- The single data file ---
  useEffect(() => {
    if (!connected) return
    const yt = gt.subscribeFile(DATA_PATH)
    textRef.current = yt
    const update = () => setDocText(yt.toString())
    update()
    yt.observe(update)
    return () => {
      yt.unobserve(update)
      textRef.current = null
    }
  }, [gt, connected])

  const doc = useMemo(() => parseDoc(docText), [docText])

  // Mutate from the freshest on-disk text (not a possibly-stale closure), so rapid
  // successive edits compose correctly. Returns the written doc.
  function write(mutate: (base: CashflowDoc) => CashflowDoc): CashflowDoc {
    const yt = textRef.current ?? gt.subscribeFile(DATA_PATH)
    const oldVal = yt.toString()
    const base = parseDoc(oldVal) ?? emptyDoc()
    const next = mutate(base)
    gt.applyDiff(yt, oldVal, serializeDoc(next))
    return next
  }

  const mapScenario = (base: CashflowDoc, id: string, fn: (sc: Scenario) => Scenario): CashflowDoc => ({
    ...base,
    scenarios: base.scenarios.map((sc) => (sc.id === id ? fn(sc) : sc)),
  })

  const actions = {
    setTimeline(patch: { globalStart?: string; globalMonths?: number }) {
      write((base) => ({ ...base, ...patch }))
    },

    addScenario(): string {
      const id = uid()
      write((base) => {
        const prev = base.scenarios[base.scenarios.length - 1]
        const scenario: Scenario = {
          id,
          name: `Scenario ${base.scenarios.length + 1}`,
          visible: true,
          opening: prev?.opening ?? 25000,
          start: prev?.start ?? base.globalStart,
          months: prev?.months ?? base.globalMonths,
          openingDate: prev?.openingDate ?? base.globalStart,
          items: [],
        }
        return { ...base, scenarios: [...base.scenarios, scenario] }
      })
      return id
    },

    duplicateScenario(id: string): string {
      const newId = uid()
      write((base) => {
        const src = base.scenarios.find((s) => s.id === id)
        if (!src) return base
        const copy: Scenario = {
          ...src,
          id: newId,
          name: `${src.name} (copy)`,
          visible: true,
          items: src.items.map((it) => ({ ...it, id: uid() })),
        }
        return { ...base, scenarios: [...base.scenarios, copy] }
      })
      return newId
    },

    removeScenario(id: string) {
      write((base) => {
        if (base.scenarios.length <= 1) return base // keep at least one
        return { ...base, scenarios: base.scenarios.filter((s) => s.id !== id) }
      })
    },

    renameScenario(id: string, name: string) {
      write((base) => mapScenario(base, id, (sc) => ({ ...sc, name })))
    },

    toggleScenarioVisible(id: string) {
      write((base) => mapScenario(base, id, (sc) => ({ ...sc, visible: !sc.visible })))
    },

    updateScenario(id: string, patch: Partial<Pick<Scenario, 'opening' | 'openingDate'>>) {
      write((base) => mapScenario(base, id, (sc) => ({ ...sc, ...patch })))
    },

    addItem(scenarioId: string, item: Item) {
      write((base) => mapScenario(base, scenarioId, (sc) => ({ ...sc, items: [...sc.items, item] })))
    },

    updateItem(scenarioId: string, item: Item) {
      write((base) =>
        mapScenario(base, scenarioId, (sc) => ({
          ...sc,
          items: sc.items.map((it) => (it.id === item.id ? item : it)),
        })),
      )
    },

    removeItem(scenarioId: string, itemId: string) {
      write((base) =>
        mapScenario(base, scenarioId, (sc) => ({ ...sc, items: sc.items.filter((it) => it.id !== itemId) })),
      )
    },

    toggleItemEnabled(scenarioId: string, itemId: string) {
      write((base) =>
        mapScenario(base, scenarioId, (sc) => ({
          ...sc,
          items: sc.items.map((it) => (it.id === itemId ? { ...it, enabled: it.enabled === false } : it)),
        })),
      )
    },

    /** Append scenarios from an uploaded JSON file. Returns a status message, or
     *  throws (caught by the caller) on invalid/unrecognized JSON. */
    importText(text: string): string {
      let message = ''
      write((base) => {
        const result = importInto(base, text)
        message = result.message
        return result.doc
      })
      return message
    },

    /** Re-anchor monthly items lacking a start date (used after timeline edits). */
    normalizeMonthly() {
      write((base) => ({ ...base, scenarios: ensureMonthlyStartDates(base.scenarios) }))
    },
  }

  return { connected, doc, actions } as const
}
