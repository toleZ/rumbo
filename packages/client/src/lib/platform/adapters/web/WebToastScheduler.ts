import toast from 'react-hot-toast'
import type {
  INotificationScheduler,
  NotificationSchedulerHandlers,
  ScheduledReminder,
} from '../../INotificationScheduler'

// How often we compare the already-fetched list against the clock. Separate from the
// network poll (owned by the caller's tRPC query) so "due" detection isn't stuck waiting
// on a refetch.
const DUE_CHECK_INTERVAL_MS = 10_000

// The existing web behavior, relocated from `components/layout/ReminderWatcher.tsx`.
// Notifies only while a tab is open — that limitation is inherent to the platform, and is
// precisely what the OS-backed scheduler exists to fix.
export class WebToastScheduler implements INotificationScheduler {
  readonly kind = 'toast' as const

  #reminders: ScheduledReminder[] = []
  // Reminders already handled this session. The server confirmation (notifiedAt) only
  // lands on the *next* poll, up to 30s later, so without this guard the due-check would
  // re-toast the same reminder repeatedly.
  #handled = new Set<string>()

  sync(reminders: ScheduledReminder[]): void {
    this.#reminders = reminders
  }

  reset(): void {
    this.#reminders = []
    this.#handled.clear()
  }

  start(handlers: NotificationSchedulerHandlers): () => void {
    const check = () => {
      const now = Date.now()
      for (const r of this.#reminders) {
        if (r.notifiedAt || this.#handled.has(r.id)) continue
        if (new Date(r.remindAt).getTime() > now) continue

        this.#handled.add(r.id)
        // Always acknowledge, even when notifications are muted, so reminders don't pile
        // up and fire all at once if the user re-enables the setting later.
        handlers.onDue(r)
        if (handlers.isEnabled()) {
          toast(handlers.formatTitle(r), { icon: '🔔', duration: 6000 })
          handlers.onNotified(r)
        }
      }
    }

    check()
    const id = setInterval(check, DUE_CHECK_INTERVAL_MS)
    return () => clearInterval(id)
  }
}
