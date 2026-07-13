import { create } from 'zustand'

export interface ReminderInfo {
  id: string
  taskId: string
  remindAt: string
  notifiedAt: string | null
  taskTitle: string
  boardId: string
}

interface ReminderState {
  /** All reminders, grouped by task, from the latest poll — drives the card badge. */
  remindersByTask: Record<string, ReminderInfo[]>
  /** Tasks with a reminder that just became due this session — drives the highlighted bell state. */
  dueTaskIds: Set<string>
  setReminders: (reminders: ReminderInfo[]) => void
  markDue: (taskId: string) => void
  clearDue: (taskId: string) => void
}

export const useReminderStore = create<ReminderState>((set) => ({
  remindersByTask: {},
  dueTaskIds: new Set(),

  setReminders: (reminders) =>
    set(() => {
      const byTask: Record<string, ReminderInfo[]> = {}
      for (const r of reminders) {
        (byTask[r.taskId] ??= []).push(r)
      }
      return { remindersByTask: byTask }
    }),

  markDue: (taskId) =>
    set((state) => {
      if (state.dueTaskIds.has(taskId)) return {}
      return { dueTaskIds: new Set(state.dueTaskIds).add(taskId) }
    }),

  // Called when the user opens the task (they've "seen" the reminder).
  clearDue: (taskId) =>
    set((state) => {
      if (!state.dueTaskIds.has(taskId)) return {}
      const next = new Set(state.dueTaskIds)
      next.delete(taskId)
      return { dueTaskIds: next }
    }),
}))
