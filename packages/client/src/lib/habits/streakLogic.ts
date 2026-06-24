import {
  format, subDays, startOfDay, startOfWeek, getISOWeek, getYear, isSameDay,
} from 'date-fns'
import type { Habit } from '../../types'
import { isHabitNormallyScheduled } from './scheduleLogic'
import type { ExceptionMap } from './scheduleLogic'

export type CompletionMap = Record<string, Record<string, { completed: boolean; value: number }>>

export function calculateStreak(
  habit: Habit,
  completions: CompletionMap,
  exceptions: ExceptionMap,
  asOf: Date,
  today: Date = startOfDay(new Date()),
): { current: number; best: number } {
  const habitCompletions = completions[habit.id] || {}
  const habitExceptions = exceptions[habit.id] || {}

  // times_per_week: count by ISO week
  if (habit.schedule.type === 'times_per_week') {
    const required = habit.schedule.times
    const weekCounts: Record<string, number> = {}
    for (let i = 0; i < 365; i++) {
      const date = subDays(today, i)
      const dateKey = format(date, 'yyyy-MM-dd')
      const entry = habitCompletions[dateKey]
      const done = habit.habitType === 'measurable'
        ? (entry?.value ?? 0) >= habit.target
        : entry?.completed ?? false
      if (done) {
        const weekKey = `${getYear(date)}-W${String(getISOWeek(date)).padStart(2, '0')}`
        weekCounts[weekKey] = (weekCounts[weekKey] ?? 0) + 1
      }
    }
    let current = 0, best = 0, runningBest = 0, currentDone = false
    for (let w = 0; w < 52; w++) {
      const weekStart = startOfWeek(subDays(today, w * 7), { weekStartsOn: 1 })
      const weekKey = `${getYear(weekStart)}-W${String(getISOWeek(weekStart)).padStart(2, '0')}`
      const fulfilled = (weekCounts[weekKey] ?? 0) >= required
      if (fulfilled) {
        runningBest++
        best = Math.max(best, runningBest)
        if (!currentDone) current++
      } else {
        if (w === 0) continue
        currentDone = true
        runningBest = 0
      }
    }
    return { current: current * 7, best: best * 7 }
  }

  // daily / specific_days / every_x_days / x_per_month: count by day
  let current = 0, currentDone = false, best = 0, runningBest = 0
  for (let i = 0; i < 365; i++) {
    const date = subDays(asOf, i)
    if (!isHabitNormallyScheduled(habit, date)) continue

    const dateKey = format(date, 'yyyy-MM-dd')
    const ex = habitExceptions[dateKey]
    if (ex?.type === 'skipped' || ex?.type === 'postponed') continue

    const entry = habitCompletions[dateKey]
    const done = habit.habitType === 'measurable'
      ? (entry?.value ?? 0) >= habit.target
      : entry?.completed ?? false

    if (done) {
      runningBest++
      best = Math.max(best, runningBest)
      if (!currentDone) current++
    } else {
      if (i === 0 && isSameDay(asOf, today)) continue
      currentDone = true
      runningBest = 0
    }
  }
  return { current, best }
}
