import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Download, Moon, Sun, TrendingUp, Upload } from 'lucide-react'
import Chart from '~/components/Chart'
import ItemsEditor from '~/components/ItemsEditor'
import ScenarioMenu from '~/components/ScenarioMenu'
import ScheduleTable from '~/components/ScheduleTable'
import { toISODate } from '~/lib/date'
import { buildChartData, buildScenarioData } from '~/lib/forecast'
import { exportPayload } from '~/lib/model'
import { useCashflow } from '~/hooks/use-cashflow'
import { useTheme } from '~/hooks/use-theme'

export default function App() {
  const { connected, doc, actions } = useCashflow()
  const { dark, canToggle, toggle } = useTheme()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [chartOpen, setChartOpen] = useState(true)
  const importRef = useRef<HTMLInputElement | null>(null)

  const scenarios = useMemo(() => doc?.scenarios ?? [], [doc])

  // Keep a valid active scenario selected.
  useEffect(() => {
    if (scenarios.length === 0) {
      setActiveId(null)
    } else if (!activeId || !scenarios.some((s) => s.id === activeId)) {
      setActiveId(scenarios[0]!.id)
    }
  }, [scenarios, activeId])

  const perScenario = useMemo(
    () => (doc ? buildScenarioData(doc.scenarios, doc.globalStart, doc.globalMonths) : []),
    [doc],
  )

  // What the chart + table actually show: every pinned (checkbox) scenario, plus
  // the active one as a temporary preview. The active scenario shows even when
  // unpinned, and stops showing as soon as you make a different one active — so
  // "active" is a transient spotlight and the checkboxes are the durable pins.
  const isShown = (s: { visible: boolean; id: string }) => s.visible || s.id === activeId
  const displayScenarios = useMemo(
    () => scenarios.map((s) => (isShown(s) ? { ...s, visible: true } : s)),
    [scenarios, activeId],
  )
  const perScenarioDisplay = useMemo(
    () => perScenario.map((d) => (isShown(d.scenario) ? { ...d, scenario: { ...d.scenario, visible: true } } : d)),
    [perScenario, activeId],
  )
  const chartData = useMemo(() => buildChartData(perScenarioDisplay), [perScenarioDisplay])
  const activeScenario = scenarios.find((s) => s.id === activeId) ?? null

  function flash(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice((cur) => (cur === message ? null : cur)), 4000)
  }

  function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        flash(actions.importText(String(reader.result ?? '')))
      } catch {
        flash('Could not import: the file is not valid Cashflow JSON.')
      }
      if (importRef.current) importRef.current.value = ''
    }
    reader.readAsText(file)
  }

  function onExport() {
    if (!doc) return
    const blob = new Blob([exportPayload(doc)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cashflow_scenarios_${toISODate(new Date())}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const isDemo = window.gt.version === 'demo'

  return (
    <div className="flex h-full flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="relative z-20 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-neutral-200 px-5 py-2 dark:border-neutral-800">
        {/* On mobile the header stacks into clean full-width rows:
            brand + actions · scenario (full) · timeline (full). On desktop it's
            one row: brand · scenario · [push] · actions · timeline. Order classes
            swap scenario/actions between the two. */}
        <div className="order-1 flex items-center gap-2">
          <TrendingUp size={18} className="text-neutral-600 dark:text-neutral-300" />
          <h1 className="text-sm font-bold tracking-tight">Cashflow</h1>
        </div>

        {doc && scenarios.length > 0 && (
          <ScenarioMenu
            className="order-3 w-full lg:order-2 lg:w-auto"
            scenarios={scenarios}
            activeId={activeId}
            onSelectActive={setActiveId}
            actions={actions}
          />
        )}

        <div className="order-2 ml-auto flex flex-wrap items-center justify-end gap-2 gap-y-2 lg:order-3">
          {notice && <span className="text-xs text-neutral-500 dark:text-neutral-400">{notice}</span>}
          {isDemo && (
            <a
              href="https://www.generaltext.org"
              title="You're using sample data, stored locally. Open General Text to use Cashflow for real."
              className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-600 hover:bg-amber-500/25 dark:text-amber-300"
            >
              Demo
            </a>
          )}
          <ConnDot connected={connected} />
          {/* The shell owns the theme in a real install (we follow it); this
              manual toggle only appears standalone/in the demo, where there's no
              shell to inherit from. */}
          {canToggle && (
            <button
              onClick={toggle}
              title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
              className="rounded-md border border-neutral-300 p-1.5 text-neutral-600 hover:bg-neutral-200 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              {dark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          )}
          <button
            onClick={() => importRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 px-2.5 py-1 text-xs text-neutral-700 hover:bg-neutral-200 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
            title="Import scenarios from a JSON file"
          >
            <Upload size={13} /> Import
          </button>
          <button
            onClick={onExport}
            disabled={!doc}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 px-2.5 py-1 text-xs text-neutral-700 hover:bg-neutral-200 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
            title="Export all scenarios as JSON"
          >
            <Download size={13} /> Export
          </button>
          <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={onImportFile} />
        </div>

        {/* Sleek inline timeline: full-width row on mobile, compact pill on desktop. */}
        <div className="order-4 flex w-full items-center justify-between rounded-md border border-neutral-300 text-[11px] lg:ml-1 lg:w-auto lg:justify-start dark:border-neutral-700">
          <label className="flex items-center gap-1.5 px-2 py-1" title="Timeline start date">
            <span className="text-neutral-400">From</span>
            <input
              type="date"
              value={doc?.globalStart ?? ''}
              onChange={(e) => actions.setTimeline({ globalStart: e.target.value })}
              disabled={!doc}
              className="w-[8.25rem] border-0 bg-transparent p-0 text-neutral-800 outline-none disabled:opacity-40 [color-scheme:light] dark:text-neutral-100 dark:[color-scheme:dark]"
            />
          </label>
          <span className="h-4 w-px bg-neutral-200 dark:bg-neutral-700" />
          <label className="flex items-center gap-1.5 px-2 py-1" title="Forecast horizon in months">
            <span className="text-neutral-400">Horizon</span>
            <input
              type="number"
              min={1}
              max={120}
              value={doc?.globalMonths ?? 12}
              onChange={(e) => actions.setTimeline({ globalMonths: Math.min(120, Math.max(1, Number(e.target.value) || 1)) })}
              disabled={!doc}
              className="w-8 border-0 bg-transparent p-0 text-right text-neutral-800 outline-none disabled:opacity-40 dark:text-neutral-100"
            />
            <span className="text-neutral-400">mo</span>
          </label>
        </div>
      </header>

      {!connected ? (
        <Centered>Connecting to your workspace…</Centered>
      ) : !doc || scenarios.length === 0 ? (
        <EmptyState onCreate={() => setActiveId(actions.addScenario())} />
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(19rem,27rem)_minmax(0,1fr)] lg:grid-rows-1 lg:overflow-hidden">
          {/* Left: the active scenario's items (the scenarios card is now the header popover) */}
          {activeScenario && (
            <ItemsEditor scenario={activeScenario} globalStart={doc.globalStart} actions={actions} />
          )}

          {/* Right: chart + schedule. Cardless — separated from the left column by a
              hairline (a top rule when stacked on mobile), and chart from schedule
              by a hairline. */}
          <div className="flex flex-col border-neutral-200 max-lg:border-t lg:min-h-0 lg:overflow-hidden lg:border-l dark:border-neutral-800">
            <section className="shrink-0 border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
              <div className={`flex items-center justify-between ${chartOpen ? 'mb-2' : ''}`}>
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Projected balance</h2>
                <button
                  onClick={() => setChartOpen((o) => !o)}
                  title={chartOpen ? 'Collapse chart (more room for transactions)' : 'Expand chart'}
                  className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                >
                  {chartOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
              </div>
              {chartOpen && (
                <div className="h-56 lg:h-72">
                  <Chart scenarios={displayScenarios} chartData={chartData} dark={dark} />
                </div>
              )}
            </section>
            <section className="flex flex-col px-5 py-4 lg:min-h-0 lg:flex-1">
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Upcoming transactions</h2>
              <ScheduleTable perScenario={perScenarioDisplay} scenarios={displayScenarios} />
            </section>
          </div>
        </div>
      )}
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="max-w-sm text-sm text-neutral-600 dark:text-neutral-400">
        No scenarios yet. A scenario is a set of recurring and one-off items projected over the
        timeline. Create one, or import a JSON export from a previous version.
      </p>
      <button
        onClick={onCreate}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-white"
      >
        Create your first scenario
      </button>
    </div>
  )
}

function ConnDot({ connected }: { connected: boolean }) {
  return (
    <span
      title={connected ? 'Connected' : 'Disconnected'}
      className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-neutral-300 dark:bg-neutral-600'}`}
    />
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 items-center justify-center p-6 text-sm text-neutral-500">{children}</div>
}
