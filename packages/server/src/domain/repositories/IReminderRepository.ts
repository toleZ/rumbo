import type { Reminder } from '@rumbo/shared'

export type ReminderRecord = Reminder & { boardUserId: string }

/** A reminder plus its task's title/board — used by the client-side poller to display a toast and to jump straight to the right board without needing that board's tasks already loaded. */
export type ReminderWithTaskTitle = Reminder & { taskTitle: string; boardId: string }

export interface IReminderRepository {
  findById(id: string): Promise<ReminderRecord | null>
  /** All of a user's reminders across every board/task, for the client-side due-reminder poller. */
  listAllByUser(userId: string): Promise<ReminderWithTaskTitle[]>
  create(taskId: string, remindAt: string): Promise<Reminder>
  update(id: string, remindAt: string): Promise<Reminder>
  /** Marks a reminder as shown to the user (sets notifiedAt) so the poller doesn't re-toast it. */
  markNotified(id: string): Promise<Reminder>
  delete(id: string): Promise<void>
}
