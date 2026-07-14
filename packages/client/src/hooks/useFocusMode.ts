import { useEffect } from 'react'
import { usePomodoroStore } from '../stores/pomodoroStore'
import { useUIStore } from '../stores/uiStore'

const TRANSITION_MS = 600

// Active for the whole pomodoro session (focus + break phases), not just
// focus phases — toggling the whole app's chrome in/out every 25/5 minutes
// would itself be visual noise, against "calm over spectacle". Only reverts
// once the session fully stops. Opt-in via settings, and never persisted as
// its own flag — it's fully derived from timerState, which the store already
// excludes from persistence, so a page reload mid-session correctly drops
// back to the user's real theme with no extra handling.
export function useFocusMode() {
  const timerState = usePomodoroStore((s) => s.timerState)
  const focusModeEnabled = usePomodoroStore((s) => s.settings.focusModeEnabled)
  const theme = useUIStore((s) => s.theme)
  const active = focusModeEnabled && timerState !== 'idle'

  useEffect(() => {
    const html = document.documentElement
    html.classList.add('theme-transition')
    const clear = window.setTimeout(() => html.classList.remove('theme-transition'), TRANSITION_MS)

    if (active) {
      html.classList.add('dark', 'focus-mode')
      html.classList.remove('light')
    } else {
      html.classList.remove('focus-mode')
      html.classList.toggle('dark', theme === 'dark')
      html.classList.toggle('light', theme === 'light')
    }

    return () => window.clearTimeout(clear)
  }, [active, theme])

  return active
}
