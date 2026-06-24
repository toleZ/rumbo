import {
  format, getDay, subDays, isAfter, isBefore,
  startOfDay, endOfDay, differenceInCalendarDays, parseISO,
} from 'date-fns'
import type { Habit, HabitSchedule } from '../../types'

export type ExceptionMap = Record<
  string,
  Record<string, { id: string; type: 'postponed' | 'skipped'; note?: string }>
>

// Checks only schedule type + date range — no exception logic (used for streak calc)
export function isHabitNormallyScheduled(habit: Habit, date: Date): boolean {
  if (habit.startDate) {
    const start = startOfDay(parseISO(habit.startDate))
    if (isBefore(date, start)) return false
  }
  if (habit.endDate) {
    const end = endOfDay(parseISO(habit.endDate))
    if (isAfter(date, end)) return false
  }

  const schedule = habit.schedule
  if (schedule.type === 'daily') return true
  if (schedule.type === 'specific_days') return schedule.days?.includes(getDay(date)) ?? true
  if (schedule.type === 'times_per_week') return true
  if (schedule.type === 'x_per_month') return true
  if (schedule.type === 'every_x_days') {
    const refDate = habit.startDate ? startOfDay(parseISO(habit.startDate)) : startOfDay(parseISO(habit.createdAt))
    const diff = differenceInCalendarDays(startOfDay(date), refDate)
    return diff >= 0 && diff % schedule.days === 0
  }
  return true
}

// Full check: includes exception logic (postpone/skip show/hide for the UI)
export function isHabitScheduledForDay(habit: Habit, date: Date, exceptions: ExceptionMap): boolean {
  const dateKey = format(date, 'yyyy-MM-dd')
  const ex = exceptions[habit.id]?.[dateKey]

  if (ex?.type === 'postponed') return false

  const yesterdayKey = format(subDays(date, 1), 'yyyy-MM-dd')
  const yesterdayEx = exceptions[habit.id]?.[yesterdayKey]
  if (yesterdayEx?.type === 'postponed') return true

  return isHabitNormallyScheduled(habit, date)
}

export function getScheduleLabel(
  schedule: HabitSchedule,
  t: (key: string, opts?: Record<string, unknown>) => string
): string {
  if (schedule.type === 'daily') return t('habits.scheduleLabel.daily')
  if (schedule.type === 'specific_days' && schedule.days) {
    if (schedule.days.length === 7) return t('habits.scheduleLabel.daily')
    if (schedule.days.length === 5 && !schedule.days.includes(0) && !schedule.days.includes(6))
      return t('habits.scheduleLabel.weekdays')
    if (schedule.days.length === 2 && schedule.days.includes(0) && schedule.days.includes(6))
      return t('habits.scheduleLabel.weekends')
    const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
    return schedule.days.map((d) => t(`habits.days.${keys[d]}`)).join('/')
  }
  if (schedule.type === 'times_per_week') return t('habits.scheduleLabel.timesPerWeek', { count: schedule.times })
  if (schedule.type === 'every_x_days') return t('habits.scheduleLabel.everyXDays', { count: schedule.days })
  if (schedule.type === 'x_per_month') return t('habits.scheduleLabel.xPerMonth', { count: schedule.times })
  return t('habits.scheduleLabel.daily')
}
