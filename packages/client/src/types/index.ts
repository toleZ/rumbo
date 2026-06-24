export type {
  Priority,
  Label,
  Subtask,
  Comment,
  Task,
  Column,
  Board,
  BoardTemplate,
  Folder,
  Note,
  HabitType,
  HabitSchedule,
  Habit,
  HabitCompletion,
  HabitException,
} from '@rumbo/shared'

export type Page = 'home' | 'today' | 'kanban' | 'calendar' | 'notes' | 'habits'
export type Theme = 'light' | 'dark'
export type CalendarView = 'daily' | 'weekly' | 'monthly'

export type PomodoroPhase = 'focus' | 'shortBreak' | 'longBreak'
export type TimerState = 'idle' | 'running' | 'paused'

export interface PomodoroSettings {
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  soundEnabled: boolean
  autoStartNext: boolean
}
