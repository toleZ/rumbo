import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PomodoroPhase, TimerState, PomodoroSettings } from '../types'

function remainingSeconds(state: { timerState: TimerState; endsAt: number | null; timeLeft: number }): number {
  if (state.timerState !== 'running' || state.endsAt === null) return state.timeLeft
  return Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000))
}

interface PomodoroState {
  phase: PomodoroPhase
  timerState: TimerState
  timeLeft: number
  // Wall-clock deadline while running (ms epoch), null otherwise. timeLeft is DERIVED
  // from this while running instead of decremented per tick, so throttled background
  // timers (browsers clamp setInterval in hidden tabs) can't make the countdown drift.
  endsAt: number | null
  sessionsCompleted: number
  settings: PomodoroSettings
  expanded: boolean
  setPhase: (phase: PomodoroPhase) => void
  setTimerState: (state: TimerState) => void
  setTimeLeft: (seconds: number) => void
  /** Recomputes timeLeft from endsAt. Driven by PomodoroTimerHost. */
  syncWithClock: () => void
  incrementSessions: () => void
  updateSettings: (s: Partial<PomodoroSettings>) => void
  toggleExpanded: () => void
  reset: () => void
}

export const usePomodoroStore = create<PomodoroState>()(
  persist(
    (set) => ({
      phase: 'focus',
      timerState: 'idle',
      timeLeft: 25 * 60,
      endsAt: null,
      sessionsCompleted: 0,
      settings: {
        focusMinutes: 25,
        shortBreakMinutes: 5,
        longBreakMinutes: 15,
        soundEnabled: true,
        autoStartNext: false,
      },
      expanded: false,

      setPhase: (phase) => set({ phase }),
      setTimerState: (timerState) =>
        set((state) => {
          if (timerState === 'running') {
            return { timerState, endsAt: Date.now() + state.timeLeft * 1000 }
          }
          // Pausing/stopping freezes whatever is left right now.
          return { timerState, endsAt: null, timeLeft: remainingSeconds(state) }
        }),
      setTimeLeft: (timeLeft) =>
        set((state) => ({
          timeLeft,
          endsAt: state.timerState === 'running' ? Date.now() + timeLeft * 1000 : null,
        })),
      syncWithClock: () =>
        set((state) => {
          if (state.timerState !== 'running') return state
          const timeLeft = remainingSeconds(state)
          return timeLeft === state.timeLeft ? state : { timeLeft }
        }),
      incrementSessions: () => set((state) => ({ sessionsCompleted: state.sessionsCompleted + 1 })),
      updateSettings: (s) =>
        set((state) => {
          const newSettings = { ...state.settings, ...s }
          const timeLeft = state.phase === 'focus'
            ? newSettings.focusMinutes * 60
            : state.phase === 'shortBreak'
            ? newSettings.shortBreakMinutes * 60
            : newSettings.longBreakMinutes * 60
          return { settings: newSettings, timeLeft, timerState: 'idle', endsAt: null }
        }),
      toggleExpanded: () => set((state) => ({ expanded: !state.expanded })),
      reset: () =>
        set((state) => ({
          timeLeft: state.phase === 'focus'
            ? state.settings.focusMinutes * 60
            : state.phase === 'shortBreak'
            ? state.settings.shortBreakMinutes * 60
            : state.settings.longBreakMinutes * 60,
          timerState: 'idle',
          endsAt: null,
        })),
    }),
    {
      name: 'pomodoro-store',
      // Only persist settings and session count — never resume a mid-countdown timer
      partialize: (state) => ({
        settings: state.settings,
        sessionsCompleted: state.sessionsCompleted,
      }),
    }
  )
)
