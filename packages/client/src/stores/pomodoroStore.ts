import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PomodoroPhase, TimerState, PomodoroSettings } from '../types'

interface PomodoroState {
  phase: PomodoroPhase
  timerState: TimerState
  timeLeft: number
  sessionsCompleted: number
  settings: PomodoroSettings
  expanded: boolean
  setPhase: (phase: PomodoroPhase) => void
  setTimerState: (state: TimerState) => void
  setTimeLeft: (seconds: number) => void
  tick: () => void
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
      sessionsCompleted: 0,
      settings: {
        focusMinutes: 25,
        shortBreakMinutes: 5,
        longBreakMinutes: 15,
        soundEnabled: true,
        autoStartNext: false,
        focusModeEnabled: false,
      },
      expanded: false,

      setPhase: (phase) => set({ phase }),
      setTimerState: (timerState) => set({ timerState }),
      setTimeLeft: (timeLeft) => set({ timeLeft }),
      tick: () => set((state) => ({ timeLeft: Math.max(0, state.timeLeft - 1) })),
      incrementSessions: () => set((state) => ({ sessionsCompleted: state.sessionsCompleted + 1 })),
      updateSettings: (s) =>
        set((state) => {
          const newSettings = { ...state.settings, ...s }
          const timeLeft = state.phase === 'focus'
            ? newSettings.focusMinutes * 60
            : state.phase === 'shortBreak'
            ? newSettings.shortBreakMinutes * 60
            : newSettings.longBreakMinutes * 60
          return { settings: newSettings, timeLeft, timerState: 'idle' }
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
