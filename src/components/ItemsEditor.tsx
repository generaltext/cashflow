import { useState } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { formatCurrency, parseDateInput, toISODate } from '~/lib/date'
import { uid, type Item, type Kind, type Scenario } from '~/lib/model'
import type { useCashflow } from '~/hooks/use-cashflow'

type Actions = ReturnType<typeof useCashflow>['actions']

// Shared field styles (light default + dark: variants). Append width utilities.
const INPUT =
  'rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100'

// A scenario's editable title + settings (opening balance + opening date) and its
// items: an add form, plus an inline editor per row. "Items" are recurring or
// one-off money movements; the forecast engine expands them over the timeline.
export default function ItemsEditor({
  scenario,
  globalStart,
  actions,
}: {
  scenario: Scenario
  globalStart: string
  actions: Actions
}) {
  const [draft, setDraft] = useState<Draft>(() => blankDraft())
  const [editId, setEditId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Draft | null>(null)

  const refDate = scenario.openingDate || globalStart

  function add() {
    actions.addItem(scenario.id, buildItem(draft, refDate))
    setDraft(blankDraft())
  }

  function startEdit(item: Item) {
    setEditId(item.id)
    setEditDraft(itemToDraft(item))
  }
  function saveEdit() {
    if (!editId || !editDraft) return
    actions.updateItem(scenario.id, buildItem(editDraft, refDate, editId))
    setEditId(null)
    setEditDraft(null)
  }

  const items = scenario.items.filter((it) => it.kind !== 'meta')

  return (
    <section className="flex flex-col px-5 py-4 lg:min-h-0 lg:flex-1">
      {/* Title doubles as an inline rename for the active scenario. */}
      <input
        value={scenario.name}
        onChange={(e) => actions.renameScenario(scenario.id, e.target.value)}
        title="Click to rename this scenario"
        className="mb-3 w-full max-w-[20rem] shrink-0 truncate rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold text-neutral-800 outline-none hover:border-neutral-300 focus:border-neutral-400 dark:text-neutral-200 dark:hover:border-neutral-700 dark:focus:border-neutral-600"
      />

      <div className="mb-3 flex shrink-0 flex-wrap items-end gap-3">
        <Field label="Opening balance">
          <input
            type="number"
            value={scenario.opening}
            onChange={(e) => actions.updateScenario(scenario.id, { opening: Number(e.target.value) || 0 })}
            className={`${INPUT} w-32`}
          />
        </Field>
        <Field label="Opening date">
          <DateField
            value={scenario.openingDate || globalStart}
            onChange={(v) => actions.updateScenario(scenario.id, { openingDate: v })}
          />
        </Field>
      </div>

      <div className="shrink-0 border-y border-neutral-200 py-3 dark:border-neutral-800">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Add item</p>
        <div className="flex flex-col gap-1.5">
          <ItemFields
            draft={draft}
            onChange={setDraft}
            trailing={
              <button
                onClick={add}
                className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-white"
              >
                <Plus size={14} /> Add
              </button>
            }
          />
        </div>
      </div>

      <ul className="mt-3 divide-y divide-neutral-200 lg:min-h-0 lg:flex-1 lg:overflow-y-auto dark:divide-neutral-800">
        {items.length === 0 && <li className="py-4 text-sm text-neutral-500">No items yet.</li>}
        {items.map((it) =>
          editId === it.id && editDraft ? (
            <li key={it.id} className="py-3">
              <div className="flex flex-col gap-1.5">
                <ItemFields draft={editDraft} onChange={setEditDraft} />
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={saveEdit}
                  className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-500"
                >
                  <Check size={13} /> Save
                </button>
                <button
                  onClick={() => {
                    setEditId(null)
                    setEditDraft(null)
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                >
                  <X size={13} /> Cancel
                </button>
              </div>
            </li>
          ) : (
            <li key={it.id} className="flex items-center gap-2 py-2">
              <input
                type="checkbox"
                checked={it.enabled !== false}
                onChange={() => actions.toggleItemEnabled(scenario.id, it.id)}
                title="Include in the forecast"
                className="accent-neutral-700 dark:accent-neutral-300"
              />
              <div className="min-w-0 flex-1">
                <div
                  className={`truncate text-sm ${
                    it.enabled === false ? 'text-neutral-400 line-through dark:text-neutral-500' : 'text-neutral-900 dark:text-neutral-100'
                  }`}
                >
                  {it.name}
                </div>
                <div className="truncate text-xs text-neutral-500">{describe(it)}</div>
              </div>
              <span
                className={`shrink-0 text-sm tabular-nums ${
                  Number(it.amount) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}
              >
                {formatCurrency(Number(it.amount) || 0)}
              </span>
              <button
                onClick={() => startEdit(it)}
                title="Edit item"
                className="rounded p-1 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => actions.removeItem(scenario.id, it.id)}
                title="Remove item"
                className="rounded p-1 text-neutral-500 hover:bg-neutral-200 hover:text-red-500 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-red-400"
              >
                <Trash2 size={13} />
              </button>
            </li>
          ),
        )}
      </ul>
    </section>
  )
}

// --- The item form, shared by add + inline edit ------------------------------

const KIND_OPTIONS: { value: Exclude<Kind, 'meta'>; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'once', label: 'One-off' },
]

// Two-row form: identity (name / amount / cadence) on top, timing (starts / ends)
// plus an optional trailing action (the Add button) below.
function ItemFields({
  draft,
  onChange,
  trailing,
}: {
  draft: Draft
  onChange: (d: Draft) => void
  trailing?: React.ReactNode
}) {
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch })
  const anchorLabel = draft.kind === 'monthly' ? 'Starts' : draft.kind === 'once' ? 'Date' : 'Anchor'
  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Name"
          className={`${INPUT} min-w-0 flex-1`}
        />
        <input
          type="number"
          value={draft.amount}
          onChange={(e) => set({ amount: e.target.value })}
          placeholder="Amount"
          className={`${INPUT} w-24`}
        />
        <select
          value={draft.kind}
          onChange={(e) => set({ kind: e.target.value as Exclude<Kind, 'meta'> })}
          className={INPUT}
        >
          {KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {draft.kind === 'monthly' && (
          <LabeledDate label={anchorLabel} value={draft.monthStartDate} onChange={(v) => set({ monthStartDate: v })} />
        )}
        {(draft.kind === 'weekly' || draft.kind === 'biweekly') && (
          <LabeledDate label={anchorLabel} value={draft.anchorDate} onChange={(v) => set({ anchorDate: v })} />
        )}
        {draft.kind === 'once' && <LabeledDate label={anchorLabel} value={draft.date} onChange={(v) => set({ date: v })} />}
        <LabeledDate label="Ends" muted value={draft.endDate} onChange={(v) => set({ endDate: v })} />
        {trailing}
      </div>
    </>
  )
}

// A bare date input styled to match the surrounding fields.
function DateField({ value, onChange }: { value: string | undefined; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className={`${INPUT} [color-scheme:light] dark:[color-scheme:dark]`}
    />
  )
}

// A compact labeled date "pill" (inline label + borderless date), mirroring the
// header timeline control — keeps the add/edit row dense.
function LabeledDate({
  label,
  value,
  onChange,
  muted,
}: {
  label: string
  value: string | undefined
  onChange: (v: string) => void
  muted?: boolean
}) {
  return (
    <label
      className={`flex items-center gap-1 rounded-md border border-neutral-300 px-1.5 py-1 text-[11px] dark:border-neutral-700 ${
        muted ? 'opacity-80' : ''
      }`}
      title={muted ? 'Optional end date' : label}
    >
      <span className="text-neutral-400">{label}</span>
      <input
        type="date"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-[6.75rem] border-0 bg-transparent p-0 text-sm text-neutral-900 outline-none [color-scheme:light] dark:text-neutral-100 dark:[color-scheme:dark]"
      />
    </label>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-0.5 text-[11px] text-neutral-500">
      {label}
      {children}
    </label>
  )
}

// --- Draft <-> Item ----------------------------------------------------------

type Draft = {
  name: string
  amount: string
  kind: Exclude<Kind, 'meta'>
  date?: string | undefined
  anchorDate?: string | undefined
  monthStartDate?: string | undefined
  endDate?: string | undefined
}

function blankDraft(): Draft {
  return { name: '', amount: '', kind: 'monthly' }
}

function itemToDraft(it: Item): Draft {
  return {
    name: it.name,
    amount: String(it.amount ?? ''),
    kind: (it.kind === 'meta' ? 'monthly' : it.kind) as Exclude<Kind, 'meta'>,
    date: it.date,
    anchorDate: it.anchorDate,
    monthStartDate: it.monthStartDate,
    endDate: it.endDate,
  }
}

/** Build a stored Item from a form draft, filling kind-specific date defaults the
 *  same way the v1 app did (monthly derives `monthStartDate` + `dayOfMonth` from a
 *  reference date; weekly/biweekly/once default to today). */
function buildItem(draft: Draft, refDateStr: string, id?: string): Item {
  const base: Item = {
    id: id ?? uid(),
    name: draft.name.trim() || 'Untitled',
    amount: Number(draft.amount) || 0,
    kind: draft.kind,
    enabled: true,
  }
  if (draft.endDate) base.endDate = draft.endDate

  if (draft.kind === 'once') {
    base.date = draft.date || toISODate(new Date())
  } else if (draft.kind === 'weekly' || draft.kind === 'biweekly') {
    base.anchorDate = draft.anchorDate || toISODate(new Date())
  } else if (draft.kind === 'monthly') {
    const ref = parseDateInput(draft.monthStartDate || refDateStr) || new Date()
    const day = ref.getDate()
    base.dayOfMonth = day
    base.monthStartDate = toISODate(new Date(ref.getFullYear(), ref.getMonth(), day))
  }
  return base
}

function describe(it: Item): string {
  const ends = it.endDate ? ` · ends ${it.endDate}` : ''
  switch (it.kind) {
    case 'monthly':
      return `Monthly from ${it.monthStartDate ?? `day ${it.dayOfMonth ?? 1}`}${ends}`
    case 'weekly':
      return `Weekly from ${it.anchorDate ?? '?'}${ends}`
    case 'biweekly':
      return `Biweekly from ${it.anchorDate ?? '?'}${ends}`
    case 'once':
      return `Once on ${it.date ?? '?'}${ends}`
    default:
      return ''
  }
}
