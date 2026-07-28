// Structural subset of `stores/reminderStore.ts`'s ReminderInfo — declared here rather
// than imported so this layer stays free of store dependencies. ReminderInfo satisfies it.
export interface ScheduledReminder {
  id: string
  taskId: string
  remindAt: string
  notifiedAt: string | null
  taskTitle: string
}

export interface NotificationSchedulerHandlers {
  /**
   * A reminder's time arrived. Fires REGARDLESS of the notification preference, so
   * reminders get acknowledged server-side rather than piling up and firing all at once
   * if the user re-enables notifications later.
   */
  onDue: (reminder: ScheduledReminder) => void
  /**
   * The user was actually shown something. Only fires when notifications are enabled —
   * this is what drives the highlighted bell, which must not light up for a reminder the
   * user was never told about.
   */
  onNotified: (reminder: ScheduledReminder) => void
  /** The user's notification preference. Read at fire time, not at start time. */
  isEnabled: () => boolean
  /** Localized notification/toast text. Lives with the caller because i18n is React-side. */
  formatTitle: (reminder: ScheduledReminder) => string
}

// When and how the user is told a reminder came due.
//
// Web can only do this while a tab is open, so it polls the clock and toasts. A native
// shell hands the whole schedule to the OS up front, which is the entire reason reminders
// work there with the app closed or the device locked.
//
// A push-backed implementation slots in behind this same interface later without any
// caller changing.
export interface INotificationScheduler {
  /** 'toast' notifies only while the app is open; 'os' survives the app being closed. */
  readonly kind: 'toast' | 'os'

  /** Begins watching. Returns a teardown. */
  start(handlers: NotificationSchedulerHandlers): () => void

  /**
   * Publishes the latest reminder set. Called on every poll, so it must be cheap and
   * idempotent — the OS-backed implementation reconciles its pending set against this.
   */
  sync(reminders: ScheduledReminder[]): void

  /**
   * Drops all retained state. Called on session end, alongside the query-cache and
   * per-user store wipes, so one user's reminders can never surface in the next session
   * in the same tab. An OS-backed implementation must additionally cancel everything it
   * has pending — otherwise the previous user's reminders keep firing on the device.
   */
  reset(): void
}
