import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// The user-facing gallery README is `public/gt-readme.md`, so Vite copies it to
// the served root next to gt.json. General Text fetches `<app-url>/gt-readme.md`
// (falling back to README.md) on install and renders it on the gallery detail
// page. It's deliberately distinct from the repo's top-level README.md, which is
// developer docs and never served.

// Dev-only: inject the platform `window.gt` runtime so the app runs standalone
// (`pnpm dev`) with a local in-browser workspace (IndexedDB + cross-tab sync) —
// no General Text server needed. In production General Text injects the runtime
// itself, so this never ships. Point GT_ORIGIN at a local worker
// (`http://localhost:5173`) if you're running General Text locally, otherwise it
// defaults to prod.
function gtRuntime(): Plugin {
  const origin = process.env.GT_ORIGIN || 'https://www.generaltext.org'
  return {
    name: 'gt-runtime',
    apply: 'serve',
    transformIndexHtml: (html) =>
      html.replace('</head>', `<script src="${origin}/__gt/runtime.js"></script></head>`),
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), gtRuntime()],
  resolve: {
    alias: { '~': resolve(__dirname, 'src') },
  },
  server: { host: '0.0.0.0', allowedHosts: true },
  preview: { host: '0.0.0.0', allowedHosts: true },
})
