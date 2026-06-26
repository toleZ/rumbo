import { Sun, Moon } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useUIStore } from '../../stores/uiStore'

export function ThemeToggle() {
  const { theme, toggleTheme } = useUIStore(useShallow(s => ({ theme: s.theme, toggleTheme: s.toggleTheme })))

  return (
    <button
      onClick={toggleTheme}
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
