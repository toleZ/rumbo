import { flushSync } from 'react-dom'
import { Sun, Moon } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useUIStore } from '../../stores/uiStore'
import { prefersReducedMotion } from '../../lib/motionPresets'

export function ThemeToggle() {
  const { theme, toggleTheme } = useUIStore(useShallow(s => ({ theme: s.theme, toggleTheme: s.toggleTheme })))

  // Circular reveal via the View Transitions API, expanding from the click
  // point. toggleTheme flips the .dark class on <html> synchronously inside
  // the store action (uiStore.ts), so the change lands inside the transition
  // callback; flushSync covers the React-rendered icon swap. Browsers without
  // the API (or reduced-motion users) get the instant toggle + icon morph.
  const handleToggle = (e: React.MouseEvent) => {
    if (!document.startViewTransition || prefersReducedMotion()) {
      toggleTheme()
      return
    }
    const x = e.clientX
    const y = e.clientY
    const vt = document.startViewTransition(() => flushSync(() => toggleTheme()))
    vt.ready.then(() => {
      const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        {
          duration: 500,
          easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
          pseudoElement: '::view-transition-new(root)',
        }
      )
    }).catch(() => { /* transition skipped (rapid toggles) — theme still applied */ })
  }

  return (
    <button
      onClick={handleToggle}
      className="p-1.5 rounded-[8px] hover:bg-[var(--surface-2)] transition-[background-color,transform] duration-[160ms] active:scale-[0.97]"
      aria-label="Toggle theme"
    >
      {theme === 'light' ? (
        <Moon key="moon" className="w-4 h-4 text-[var(--label-2)] theme-icon-enter" />
      ) : (
        <Sun key="sun" className="w-4 h-4 text-[var(--label-2)] theme-icon-enter" />
      )}
    </button>
  )
}
