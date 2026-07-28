import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { trpc } from '../../lib/trpc'
import { notificationScheduler } from '../../lib/platform'
import { useReminderStore } from '../../stores/reminderStore'
import { useUIStore } from '../../stores/uiStore'

// How often we re-fetch the full reminder list (catches adds/edits/deletes
// made elsewhere — another tab, the AI assistant, etc.). Network cadence, so it stays
// here rather than in the scheduler, which owns only the "when do we tell the user" half.
const POLL_INTERVAL_MS = 30_000

/**
 * Invisible, always-mounted watcher (see Layout.tsx): polls the user's reminders, keeps
 * the reminder store fed, and hands the current set to the platform's notification
 * scheduler.
 *
 * On web that scheduler compares against the clock and toasts, so it fires only while the
 * app is open in some tab. A native shell schedules with the OS instead and fires with the
 * app closed — this component doesn't know or care which one it got.
 */
export function ReminderWatcher() {
  const { t } = useTranslation()
  const setReminders = useReminderStore((s) => s.setReminders)
  const markDue = useReminderStore((s) => s.markDue)
  const remindersQuery = trpc.reminders.listAll.useQuery(undefined, {
    refetchInterval: POLL_INTERVAL_MS,
  })
  const acknowledgeMutation = trpc.reminders.acknowledge.useMutation()

  // A ref so the scheduler's callback always sees the fresh mutate without having to tear
  // down and recreate the subscription on every poll/re-render. Assigned in an effect
  // rather than during render — a ref write during render can be discarded by a bailout.
  const acknowledgeRef = useRef(acknowledgeMutation.mutate)
  useEffect(() => {
    acknowledgeRef.current = acknowledgeMutation.mutate
  })

  useEffect(() => {
    const data = remindersQuery.data ?? []
    setReminders(data)
    notificationScheduler.sync(data)
  }, [remindersQuery.data, setReminders])

  useEffect(() => {
    return notificationScheduler.start({
      // Fires regardless of the notifications toggle — the reminder is still acknowledged
      // server-side so it doesn't pile up and fire all at once if the user re-enables the
      // setting later.
      onDue: (r) => acknowledgeRef.current({ id: r.id }),
      // Only when the user was actually shown something, so the bell doesn't light up for
      // a reminder they were never told about.
      onNotified: (r) => markDue(r.taskId),
      isEnabled: () => useUIStore.getState().notificationsEnabled,
      formatTitle: (r) => t('reminder.due', { title: r.taskTitle }),
    })
    // Re-subscribing on a language change is intentional and harmless: the scheduler
    // keeps its own already-handled set across start/stop, so nothing re-fires.
  }, [markDue, t])

  return null
}
