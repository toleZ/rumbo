import { create } from 'zustand'
import type { Habit, HabitCompletion, HabitException } from '../types'

const generateId = () => crypto.randomUUID()

// Nested shape: completions[habitId][dateKey] = { completed: boolean; value: number }
export type CompletionsMap = Record<string, Record<string, { completed: boolean; value: number }>>
// Nested shape: exceptions[habitId][dateKey] = { id, type, note? }
export type ExceptionsMap = Record<string, Record<string, { id: string; type: 'postponed' | 'skipped'; note?: string }>>

// For measurable habits, "completed" means the value reached the target —
// not merely that some progress (> 0) was logged.
function isCompletedValue(habit: Habit | undefined, value: number): boolean {
  return habit?.habitType === 'measurable' ? value >= habit.target : value > 0
}

function buildCompletionsMap(flat: HabitCompletion[], habits: Habit[]): CompletionsMap {
  const habitById = new Map(habits.map((h) => [h.id, h]))
  const map: CompletionsMap = {}
  for (const c of flat) {
    if (!map[c.habitId]) map[c.habitId] = {}
    map[c.habitId][c.date] = { completed: isCompletedValue(habitById.get(c.habitId), c.value), value: c.value }
  }
  return map
}

function buildExceptionsMap(flat: HabitException[]): ExceptionsMap {
  const map: ExceptionsMap = {}
  for (const e of flat) {
    if (!map[e.habitId]) map[e.habitId] = {}
    map[e.habitId][e.date] = { id: e.id, type: e.type, note: e.note }
  }
  return map
}

interface HabitState {
  habits: Habit[]
  completions: CompletionsMap
  exceptions: ExceptionsMap
  isHydrated: boolean
  hydrate: (data: { habits: Habit[]; completions: HabitCompletion[]; exceptions: HabitException[] }) => void
  addHabit: (params: Omit<Habit, 'id' | 'createdAt'>) => void
  updateHabit: (id: string, updates: Partial<Habit>) => void
  deleteHabit: (id: string) => void
  toggleCompletion: (habitId: string, date: string) => void
  setMeasurableValue: (habitId: string, date: string, value: number) => void
  logCompletion: (habitId: string, date: string, value: number) => void
  removeCompletion: (habitId: string, date: string) => void
  addException: (ex: HabitException) => void
  removeException: (habitId: string, date: string) => void
  reset: () => void
}

export const useHabitStore = create<HabitState>((set, get) => ({
  habits: [],
  completions: {},
  exceptions: {},
  isHydrated: false,

  // Wipe all per-user data — called on login/logout to prevent cross-user bleed.
  reset: () => set({ habits: [], completions: {}, exceptions: {}, isHydrated: false }),

  hydrate: ({ habits, completions, exceptions }) =>
    set({
      habits,
      completions: buildCompletionsMap(completions, habits),
      exceptions: buildExceptionsMap(exceptions),
      isHydrated: true,
    }),

  addHabit: (params) =>
    set((state) => ({
      habits: [
        ...state.habits,
        { id: generateId(), ...params, createdAt: new Date().toISOString() },
      ],
    })),

  updateHabit: (id, updates) =>
    set((state) => ({
      habits: state.habits.map((h) => (h.id === id ? { ...h, ...updates } : h)),
    })),

  deleteHabit: (id) =>
    set((state) => {
      const completions = { ...state.completions }
      const exceptions = { ...state.exceptions }
      delete completions[id]
      delete exceptions[id]
      return {
        habits: state.habits.filter((h) => h.id !== id),
        completions,
        exceptions,
      }
    }),

  toggleCompletion: (habitId, date) =>
    set((state) => {
      const current = state.completions[habitId]?.[date]
      const isCompleted = current?.completed ?? false
      const habitMap = { ...(state.completions[habitId] ?? {}) }
      if (isCompleted) {
        delete habitMap[date]
      } else {
        habitMap[date] = { completed: true, value: 1 }
      }
      return { completions: { ...state.completions, [habitId]: habitMap } }
    }),

  setMeasurableValue: (habitId, date, value) =>
    set((state) => ({
      completions: {
        ...state.completions,
        [habitId]: {
          ...(state.completions[habitId] ?? {}),
          [date]: { completed: isCompletedValue(state.habits.find((h) => h.id === habitId), value), value },
        },
      },
    })),

  logCompletion: (habitId, date, value) => get().setMeasurableValue(habitId, date, value),

  removeCompletion: (habitId, date) =>
    set((state) => {
      const habitMap = { ...(state.completions[habitId] ?? {}) }
      delete habitMap[date]
      return { completions: { ...state.completions, [habitId]: habitMap } }
    }),

  addException: (ex) =>
    set((state) => ({
      exceptions: {
        ...state.exceptions,
        [ex.habitId]: {
          ...(state.exceptions[ex.habitId] ?? {}),
          [ex.date]: { id: ex.id, type: ex.type, note: ex.note },
        },
      },
    })),

  removeException: (habitId, date) =>
    set((state) => {
      const habitMap = { ...(state.exceptions[habitId] ?? {}) }
      delete habitMap[date]
      return { exceptions: { ...state.exceptions, [habitId]: habitMap } }
    }),
}))
