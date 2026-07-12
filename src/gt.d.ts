// Ambient types for the platform-injected `window.gt` runtime. General Text
// injects the runtime at serve time (and a dev vite plugin injects it locally),
// so this app bundles NO sync client and no yjs — these are types only.
//
// This is the minimal surface Cashflow uses. The full contract is documented at
// generaltext.org/docs/building-apps.

/** The live CRDT text for a file — methods ride on the object the runtime hands
 *  back; we never construct one, so no yjs import is needed. */
interface GtText {
  toString(): string
  readonly length: number
  insert(index: number, content: string): void
  delete(index: number, length: number): void
  observe(fn: () => void): void
  unobserve(fn: () => void): void
}

interface GtApi {
  /** Resolves once connected to the workspace. */
  readonly ready: Promise<void>
  readonly version: string
  readonly connected: boolean
  /** 'demo' in the gallery "Try it live" demo (and the App Builder preview),
   *  'live' in a normal workspace. Added in runtime 1.3; optional so older
   *  runtimes (where we fall back to `sync.isLocal`) still typecheck. */
  readonly mode?: 'demo' | 'live'

  /** The shell's current light/dark theme and palette (runtime 1.8+). The
   *  platform applies it to <html> automatically (the `dark` class +
   *  `color-scheme` + design tokens) and fires `theme-changed` on every toggle;
   *  we read `mode` here to recolor the canvas chart. Absent on older runtimes
   *  and in the standalone/demo runtime, where there's no shell to follow. */
  readonly theme?: { mode: 'light' | 'dark'; vars: Record<string, string> }

  // Live editing.
  subscribeFile(path: string): GtText
  unsubscribeFile(path: string): void
  applyDiff(text: GtText, oldVal: string, newVal: string): void

  // Whole-file ops.
  writeFile(path: string, content: string): Promise<void>
  deleteFile(path: string): Promise<void>
  listFiles(): Promise<{ path: string; sizeBytes: number }[]>

  // File list + connection.
  files(): string[]
  watchFiles(cb: (paths: string[]) => void): () => void
  on(
    event: 'connected' | 'disconnected' | 'mode-changed' | 'error' | 'theme-changed',
    cb: (...args: unknown[]) => void,
  ): () => void

  /** Escape hatch to the underlying client (e.g. dev-only `isLocal`, and
   *  `getFileText` which returns undefined for an unsubscribed file). */
  readonly sync: {
    readonly isLocal: boolean
    getFileText(path: string): GtText | undefined
  }
}

interface Window {
  gt: GtApi
}
