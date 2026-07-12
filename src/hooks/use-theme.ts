// use-theme.ts — follow the shell's light/dark theme.
//
// The shell owns the theme. In a real install (runtime 1.8+) the platform sets
// `gt.theme`, fires `theme-changed` on every toggle, and applies the `dark`
// class to <html> itself — so we just mirror its `mode` into state (our canvas
// chart needs the boolean in JS) and never decide for ourselves. Outside the
// shell (standalone `pnpm dev`, the gallery "Try it live" demo) there's no theme
// to inherit, so we fall back to a local manual toggle and own the `dark` class.

import { useEffect, useState } from 'react'

type Mode = 'light' | 'dark'

export function useTheme() {
  const gt = window.gt
  // `gt.theme` is only present inside the shell on runtime 1.8+. When it's absent
  // (older host, or the standalone/demo runtime) there's nothing to follow, so we
  // own the theme via a manual toggle instead.
  const hasShellTheme = !!gt.theme
  const [mode, setMode] = useState<Mode>(() => gt.theme?.mode ?? 'light')

  // Live install: follow the shell. The runtime already toggles the `dark` class
  // (synchronously, before first paint), so we only track `mode` for components
  // that read it in JS.
  useEffect(() => {
    if (!gt.theme) return
    setMode(gt.theme.mode)
    return gt.on('theme-changed', (t) => setMode((t as { mode: Mode }).mode))
  }, [gt])

  // No shell to follow: we own the `dark` class on <html>.
  useEffect(() => {
    if (hasShellTheme) return
    document.documentElement.classList.toggle('dark', mode === 'dark')
  }, [hasShellTheme, mode])

  return {
    dark: mode === 'dark',
    /** Only the standalone/demo runtime exposes a manual toggle; a real install
     *  defers to the shell's own theme control and hides ours. */
    canToggle: !hasShellTheme,
    toggle: () => setMode((m) => (m === 'dark' ? 'light' : 'dark')),
  }
}
