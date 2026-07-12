import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Copy, Minus, Pencil, Plus, Trash2 } from 'lucide-react'
import { colorForIndex } from '~/lib/forecast'
import type { Scenario } from '~/lib/model'
import type { useCashflow } from '~/hooks/use-cashflow'

type Actions = ReturnType<typeof useCashflow>['actions']

// The scenario popover (Approach A): the single home for scenarios. The trigger
// shows the active scenario; the menu lets you toggle which scenarios show on the
// chart/table (checkbox), pick the active one (click a row — drives the Items and
// schedule cards), rename via the pencil, and add / duplicate / remove. Clicking a
// row only selects; the menu stays open until you click out or press Escape.
export default function ScenarioMenu({
  scenarios,
  activeId,
  onSelectActive,
  actions,
  className,
}: {
  scenarios: Scenario[]
  activeId: string | null
  onSelectActive: (id: string) => void
  actions: Actions
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Leaving rename mode whenever the menu closes keeps state tidy.
  useEffect(() => {
    if (!open) setRenamingId(null)
  }, [open])

  const activeIdx = Math.max(0, scenarios.findIndex((s) => s.id === activeId))
  const active = scenarios[activeIdx]

  return (
    <div ref={ref} className={`relative ${className ?? ''}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex w-full items-center justify-between gap-2 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-800 hover:bg-neutral-100 lg:w-auto lg:justify-start dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
      >
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorForIndex(activeIdx) }} />
        <span className="flex-1 truncate text-left lg:max-w-[12rem] lg:flex-none">{active?.name ?? 'Scenarios'}</span>
        <ChevronDown size={13} className="shrink-0 text-neutral-400" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+6px)] z-30 w-full rounded-lg border border-neutral-200 bg-white p-1.5 shadow-xl lg:w-72 dark:border-neutral-700 dark:bg-neutral-900"
        >
          <ul className="max-h-72 overflow-y-auto">
            {scenarios.map((sc, idx) => {
              const cur = sc.id === activeId
              const renaming = sc.id === renamingId
              return (
                <li
                  key={sc.id}
                  onClick={() => onSelectActive(sc.id)}
                  className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 ${
                    cur ? 'bg-sky-50 dark:bg-sky-500/10' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  {/* Custom tri-state box: pinned (check) · active-preview (centered
                      dash) · off (empty). A native indeterminate checkbox draws a
                      full-width bar, which read as broken. */}
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={sc.visible ? 'true' : !sc.visible && cur ? 'mixed' : 'false'}
                    onClick={(e) => {
                      e.stopPropagation()
                      actions.toggleScenarioVisible(sc.id)
                    }}
                    title={
                      sc.visible
                        ? 'Pinned — showing on chart and table'
                        : cur
                          ? 'Previewing (active) — click to keep it pinned'
                          : 'Show on chart and table'
                    }
                    className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border transition-colors ${
                      sc.visible
                        ? 'border-neutral-700 bg-neutral-700 text-white dark:border-neutral-300 dark:bg-neutral-300 dark:text-neutral-900'
                        : cur
                          ? 'border-neutral-400 text-neutral-500 dark:border-neutral-500 dark:text-neutral-400'
                          : 'border-neutral-300 dark:border-neutral-600'
                    }`}
                  >
                    {sc.visible ? <Check size={10} strokeWidth={3.5} /> : cur ? <Minus size={10} strokeWidth={3.5} /> : null}
                  </button>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorForIndex(idx) }} />

                  {renaming ? (
                    <input
                      autoFocus
                      value={sc.name}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => actions.renameScenario(sc.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') {
                          e.stopPropagation() // don't let Escape also close the menu
                          setRenamingId(null)
                        }
                      }}
                      onBlur={() => setRenamingId(null)}
                      className="min-w-0 flex-1 rounded border border-neutral-400 bg-white px-1 py-0.5 text-sm text-neutral-900 outline-none dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
                    />
                  ) : (
                    <span className={`min-w-0 flex-1 truncate text-sm text-neutral-900 dark:text-neutral-100 ${cur ? 'font-medium' : ''}`}>
                      {sc.name}
                    </span>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectActive(sc.id)
                      setRenamingId(sc.id)
                    }}
                    title="Rename scenario"
                    className="rounded p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      actions.removeScenario(sc.id)
                    }}
                    disabled={scenarios.length <= 1}
                    title={scenarios.length <= 1 ? 'Keep at least one scenario' : 'Remove scenario'}
                    className="rounded p-1 text-neutral-400 enabled:hover:bg-neutral-200 enabled:hover:text-red-500 disabled:opacity-30 dark:enabled:hover:bg-neutral-700 dark:enabled:hover:text-red-400"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="mt-1 flex gap-1.5 border-t border-neutral-200 pt-1.5 dark:border-neutral-700">
            <button
              onClick={() => {
                const id = actions.addScenario()
                onSelectActive(id)
                setRenamingId(id) // new scenarios open straight into rename
              }}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-neutral-900 px-2 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-white"
            >
              <Plus size={13} /> Add scenario
            </button>
            <button
              onClick={() => active && onSelectActive(actions.duplicateScenario(active.id))}
              title="Duplicate the active scenario"
              className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 px-2 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              <Copy size={13} /> Duplicate
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
