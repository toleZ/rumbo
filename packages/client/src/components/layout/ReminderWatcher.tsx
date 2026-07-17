import { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { trpc } from '../../lib/trpc'
import { useReminderStore } from '../../stores/reminderStore'
import { useUIStore } from '../../stores/uiStore'

// How often we re-fetch the full reminder list (catches adds/edits/deletes
// made elsewhere — another tab, the AI assistant, etc.).
const POLL_INTERVAL_MS = 30_000
// How often we compare the already-fetched list against the clock. Separate
// from the network poll so "due" detection isn't stuck waiting up to 30s.
const DUE_CHECK_INTERVAL_MS = 10_000

/**
 * Invisible, always-mounted watcher (see Layout.tsx): polls the user's
 * reminders and, purely client-side (no push/OS notifications — see the
 * Reminders feature scope), toasts + flags a task's bell icon as "due" the
 * moment a reminder's time is reached while the app is open in some tab.
 */
export function ReminderWatcher() {
  const { t } = useTranslation()
  const setReminders = useReminderStore((s) => s.setReminders)
  const markDue = useReminderStore((s) => s.markDue)
  const remindersQuery = trpc.reminders.listAll.useQuery(undefined, {
    refetchInterval: POLL_INTERVAL_MS,
  })
  const acknowledgeMutation = trpc.reminders.acknowledge.useMutation()

  // Refs so the interval callback always sees fresh data/handlers without
  // having to tear down and recreate the interval on every poll/re-render.
  const remindersRef = useRef(remindersQuery.data ?? [])
  const acknowledgeRef = useRef(acknowledgeMutation.mutate)
  acknowledgeRef.current = acknowledgeMutation.mutate
  // Reminders already toasted this session — the server confirmation
  // (notifiedAt) only lands on the *next* poll, up to 30s later, so without
  // this guard the 10s due-check would re-toast the same reminder repeatedly.
  const handledRef = useRef(new Set<string>())

  useEffect(() => {
    const data = remindersQuery.data ?? []
    remindersRef.current = data
    setReminders(data)
  }, [remindersQuery.data, setReminders])

  useEffect(() => {
    const check = () => {
      const now = Date.now()
      for (const r of remindersRef.current) {
        if (r.notifiedAt || handledRef.current.has(r.id)) continue
        if (new Date(r.remindAt).getTime() > now) continue

        handledRef.current.add(r.id)
        acknowledgeRef.current({ id: r.id })
        // Notifications toggle (settings) gates the user-facing ping only — the
        // reminder is still acknowledged server-side so it doesn't pile up and
        // fire all at once if the user re-enables the setting later.
        if (useUIStore.getState().notificationsEnabled) {
          markDue(r.taskId)
          toast(t('reminder.due', { title: r.taskTitle }), { icon: '🔔', duration: 6000 })
        }
      }
    }
    check()
    const id = setInterval(check, DUE_CHECK_INTERVAL_MS)
    return () => clearInterval(id)
  }, [markDue, t])

  return null
}
