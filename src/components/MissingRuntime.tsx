import { ExternalLink, Play, TrendingUp } from 'lucide-react'

// Shown when the app is opened outside General Text — i.e. there's no injected
// `window.gt` runtime (visiting the deployed site directly, rather than launching
// it from a workspace). A gt app has no backend of its own, so on its own there's
// nothing to read or write; point the visitor at how to actually use it — and let
// them try a local, sample-data demo right here.
export default function MissingRuntime({ onTryDemo }: { onTryDemo: () => void }) {
  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://cashflow.generaltext.org'

  return (
    <div className="flex min-h-full items-center justify-center bg-neutral-900 px-6 py-12 text-neutral-100">
      <div className="w-full max-w-md space-y-5 rounded-xl border border-neutral-800 bg-neutral-950 p-7">
        <div className="flex items-center gap-2.5">
          <TrendingUp size={22} className="text-neutral-300" />
          <div>
            <h1 className="text-lg font-bold leading-tight">Cashflow</h1>
            <p className="text-xs text-neutral-500">A General Text app</p>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-neutral-300">
          Cashflow runs <span className="font-medium text-neutral-100">inside General Text</span> — a
          workspace for plain-text files that sync across your devices. Opened on its own like this,
          it has no workspace to read or write, so there's nothing to show.
        </p>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            To use Cashflow
          </p>
          <ol className="space-y-1.5 text-sm text-neutral-300">
            <Step n={1}>
              Open <Link href="https://www.generaltext.org">General Text</Link> and create or open a
              workspace.
            </Step>
            <Step n={2}>
              Go to <span className="text-neutral-100">Settings → Apps → Install by URL</span>.
            </Step>
            <Step n={3}>
              Paste this app's address:
              <code className="mt-1 block rounded bg-neutral-800 px-2 py-1 font-mono text-xs text-neutral-200">
                {appUrl}
              </code>
            </Step>
            <Step n={4}>Launch Cashflow from your workspace.</Step>
          </ol>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href="https://www.generaltext.org"
            className="inline-flex items-center gap-1.5 rounded-md bg-neutral-200 px-3.5 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-white"
          >
            Open General Text
            <ExternalLink size={14} />
          </a>
          <a
            href="/demo"
            onClick={(e) => {
              // Plain left-click → SPA nav; let modified clicks open /demo normally.
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
              e.preventDefault()
              onTryDemo()
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-700 px-3.5 py-2 text-sm font-medium text-neutral-200 transition-colors hover:border-neutral-500 hover:bg-neutral-800"
          >
            <Play size={14} />
            Try the demo
          </a>
        </div>
        <p className="-mt-2 text-xs text-neutral-600">
          The demo loads sample scenarios locally in your browser — nothing is saved to an
          account, and changes stay on this device.
        </p>

        <p className="text-xs text-neutral-600">
          Building your own app?{' '}
          <Link href="https://www.generaltext.org/docs/building-apps">Read the developer guide</Link>.
        </p>
      </div>
    </div>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-[11px] font-medium text-neutral-400">
        {n}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </li>
  )
}

function Link({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="text-neutral-100 underline decoration-neutral-600 underline-offset-2 hover:decoration-neutral-300">
      {children}
    </a>
  )
}
