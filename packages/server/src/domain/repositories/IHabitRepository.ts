import type { Habit, HabitCompletion, HabitException, HabitSchedule, HabitType } from '@rumbo/shared'

export type HabitRecord = Habit & { userId: string }

export type HabitWithActivity = Habit & {
  completions: HabitCompletion[]
  exceptions: HabitException[]
}

export interface CreateHabitInput {
  name: string
  habitType: HabitType
  schedule: HabitSchedule
  target: number
  unit: string
  color: string
  startDate?: string | null
  endDate?: string | null
  step?: number | null
}

export interface UpdateHabitInput {
  name?: string
  habitType?: HabitType
  schedule?: HabitSchedule
  target?: number
  unit?: string
  color?: string
  startDate?: string | null
  endDate?: string | null
  step?: number | null
}

export interface IHabitRepository {
  findAllByUser(userId: string, since?: string): Promise<HabitWithActivity[]>
  findById(id: string): Promise<HabitRecord | null>
  create(userId: string, data: CreateHabitInput): Promise<HabitWithActivity>
  update(id: string, data: UpdateHabitInput): Promise<HabitWithActivity>
  delete(id: string): Promise<void>
  upsertCompletion(habitId: string, date: string, value: number): Promise<HabitCompletion>
  deleteCompletion(habitId: string, date: string): Promise<void>
  upsertException(habitId: string, date: string, type: 'postponed' | 'skipped', note?: string): Promise<HabitException>
  deleteException(habitId: string, date: string): Promise<void>
}
