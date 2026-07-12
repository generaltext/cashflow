# Cashflow

A General Text app — a cashflow forecaster. Define recurring and one-off income/expense
items, project a running balance over a shared timeline, and overlay multiple scenarios to
compare what-ifs. A port of an earlier standalone build onto General Text: no backend, all
state is one synced file.

Built against the app guide: https://www.generaltext.org/llms.txt
(local source: `projects/generaltext/content/docs/building-apps.md`).

## Data model

The app's only writable scope is its data folder, `_gtApps/cashflow/data/`, versioned
inside it under `data/v{major}/` (`v0` today, matching the `0.x` version in `gt.json`). On a
breaking format change we'd bump the major and migrate ourselves (read `data/v{old}/`,
transform, write `data/v{new}/`); the platform does not migrate for us. Paths passed to
`window.gt` are **relative** to that data folder — the runtime maps `v0/...` to wherever the
app is actually installed, so we never hardcode `_gtApps/cashflow/...`.

The entire model is a single JSON file, `data/v0/cashflow.json`:

```json
{
  "version": 1,
  "globalStart": "2026-01-09",
  "globalMonths": 24,
  "scenarios": [
    {
      "id": "…", "name": "Baseline", "visible": true,
      "opening": 18278, "openingDate": "2026-01-09", "start": "2026-01-09", "months": 12,
      "items": [
        { "id": "…", "name": "Paycheck", "amount": 3500, "kind": "biweekly", "anchorDate": "2025-08-07", "enabled": true },
        { "id": "…", "name": "Mortgage", "amount": -2800, "kind": "monthly", "dayOfMonth": 15, "monthStartDate": "2026-01-15", "enabled": true }
      ]
    }
  ]
}
```

This is the same shape the previous standalone build exported, so files move between the two
losslessly (Export writes it without the internal `version` field; Import accepts it plus the
older legacy formats — a single-config `{ items, opening?, … }`, a localStorage dump, or a
bare items array). `amount` may be a number or a string in imported data; the forecast engine
coerces with `Number()` and we preserve whatever was stored so untouched items round-trip.

Item kinds: `monthly` (a `dayOfMonth`/`monthStartDate`), `weekly`/`biweekly` (step from
`anchorDate`), `once` (a `date`), and `meta` (a non-projected marker, e.g. "Starting Balance",
kept for round-trip but not editable in the UI). Any item may carry an `endDate`.

Because it's one file, edits are written whole (`gt.applyDiff` against the live text); the
runtime turns that into a minimal CRDT diff so it still merges cleanly and only changed bytes
move.

## Code map

- `src/lib/model.ts` — types, (de)serialization, normalization, and import of every legacy format.
- `src/lib/forecast.ts` — the pure projection engine (expand items → events → running balance →
  chart rows + schedule), ported from the v1 app. No React, no I/O.
- `src/lib/date.ts` — local-time date helpers and currency formatting.
- `src/hooks/use-cashflow.ts` — the data layer: one subscribe/observe lifecycle on
  `cashflow.json`, parsed into a `CashflowDoc`, with actions that write the next whole doc back.
- `src/components/` — `ScenarioList`, `ItemsEditor`, `Chart` (recharts), `ScheduleTable`,
  and `MissingRuntime` (the out-of-platform landing screen).

## Develop

```bash
pnpm install
pnpm dev        # vite dev server — runs standalone, no General Text server needed
pnpm build      # tsc + vite build → dist/ (static, installable)
pnpm preview    # serve the built app
```

Cashflow talks to General Text through the platform-injected **`window.gt`** runtime — it
bundles no sync client and no yjs (see `src/gt.d.ts` for the typed surface it uses). In
production General Text injects the runtime; for `pnpm dev` a tiny vite plugin
(`vite.config.ts`) injects it from a General Text origin so the app runs standalone against a
**local in-browser workspace** (IndexedDB + cross-tab sync), no account or server needed. A
fresh local workspace is seeded from `src/lib/dev-seed.ts` (generic sample scenarios — no real
figures) — inert under a real host (`window.gt.sync.isLocal` is false).

By default the dev runtime loads from `https://www.generaltext.org/__gt/runtime.js`. Running
General Text locally? Point at it: `GT_ORIGIN=http://localhost:5173 pnpm dev`.

Opened outside General Text (e.g. visiting the deployed URL directly), there's no injected
`window.gt`, so the app renders a small landing screen (`src/components/MissingRuntime.tsx`)
that links to a **`/demo`** route — its own URL (linkable, refreshable). The route installs a
local, sample-data stand-in for `window.gt` (`src/lib/demo-runtime.ts`) — strings in memory,
mirrored to `localStorage`, no network — so visitors can play with the app right there. The
app runs unchanged against it and shows a "Demo" badge. (Routing is plain History API in
`main.tsx`; no router dependency.)

## Deploy (Cloudflare)

Pure static build (`dist/`), no backend, no secrets, no bindings. Either Cloudflare host works;
the repo is set up for **Workers static assets**.

**Workers (this repo's setup).** `wrangler.jsonc` defines an assets-only Worker that serves
`dist/`. Connect the repo in **Workers & Pages → Create → Import a repository**, with build
command `pnpm build` and deploy command `npx wrangler deploy` (or run `npx wrangler deploy`
locally). SPA fallback for `/demo` is **`assets.not_found_handling: "single-page-application"`**
in `wrangler.jsonc` — any unmatched path returns `index.html` (200). Do **not** add a
`_redirects` `/*  /index.html  200` rule: Workers Assets rejects it as an infinite loop (it's a
Pages-only convention).

**Pages (alternative).** Create a **Pages** project (Connect to Git), preset None, build
`pnpm build`, output `dist`. Pages uses a `public/_redirects` `/*  /index.html  200` for SPA
fallback instead of the Wrangler setting — add that file back if you go this route. No
`wrangler.jsonc` or deploy command needed.

Either way, add the custom domain `cashflow.generaltext.org` (matches `url` in `gt.json`).

Notes: `dist/` is gitignored (built from source). The user-facing gallery README is
`public/gt-readme.md` (served at the build root next to `gt.json`); this repo `README.md` is
developer docs and is never served. Installs are immutable per version — bump `gt.json` version
(or uninstall/reinstall) to pick up rebuilt bytes.
