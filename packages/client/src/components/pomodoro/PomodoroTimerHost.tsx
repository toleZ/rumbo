import { useEffect, useRef } from 'react'
import { usePomodoroStore } from '../../stores/pomodoroStore'

function playChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const now = ctx.currentTime
    const frequencies = [587.33, 783.99]
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now)
      const start = now + i * 0.2
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.3, start + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.8)
      osc.start(start)
      osc.stop(start + 0.8)
    })
    setTimeout(() => ctx.close(), 2000)
  } catch {}
}

// Sub-second so the displayed second flips close to the real boundary; cheap, since
// syncWithClock is a no-op unless the displayed value actually changes.
const SYNC_INTERVAL_MS = 250

/**
 * Invisible, always-mounted owner of the Pomodoro countdown (rendered in ActionRing.tsx
 * next to AmbientPlayer and SpotifyPlaybackHost, for the same reason). The timer used to
 * live inside PomodoroWidget, which unmounts whenever its ring card closes — so the
 * countdown froze while the store still said 'running'.
 */
export function PomodoroTimerHost() {
  const timerState = usePomodoroStore((s) => s.timerState)
  const timeLeft = usePomodoroStore((s) => s.timeLeft)
  const phase = usePomodoroStore((s) => s.phase)
  const prevPhaseRef = useRef(phase)

  // Drive the clock while running. Also resync the moment the tab becomes visible again,
  // since hidden-tab intervals can be clamped to once a minute.
  useEffect(() => {
    if (timerState !== 'running') return
    const sync = () => usePomodoroStore.getState().syncWithClock()
    sync()
    const id = setInterval(sync, SYNC_INTERVAL_MS)
    document.addEventListener('visibilitychange', sync)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [timerState])

  // Phase finished → advance to the next one. Reads fresh state via getState() so the
  // transition never acts on a stale closure.
  useEffect(() => {
    const s = usePomodoroStore.getState()
    if (timeLeft !== 0 || s.timerState !== 'running') return
    if (s.phase === 'focus') {
      const newCount = s.sessionsCompleted + 1
      s.incrementSessions()
      // Long break after every 4th focus session (standard Pomodoro technique)
      if (newCount % 4 === 0) {
        s.setPhase('longBreak')
        s.setTimeLeft(s.settings.longBreakMinutes * 60)
      } else {
        s.setPhase('shortBreak')
        s.setTimeLeft(s.settings.shortBreakMinutes * 60)
      }
    } else {
      // After any break, return to focus
      s.setPhase('focus')
      s.setTimeLeft(s.settings.focusMinutes * 60)
    }
    s.setTimerState(s.settings.autoStartNext ? 'running' : 'idle')
  }, [timeLeft])

  // Single chime source: every phase change (natural end or skip). The completion handler
  // above deliberately doesn't chime too — it used to, which played the sound twice.
  useEffect(() => {
    if (prevPhaseRef.current !== phase && usePomodoroStore.getState().settings.soundEnabled) playChime()
    prevPhaseRef.current = phase
  }, [phase])

  return null
}
