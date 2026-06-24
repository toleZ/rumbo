export type Priority = 'low' | 'medium' | 'high' | 'urgent'

export interface Label {
  id: string
  name: string
  color: string
}

export interface Subtask {
  id: string
  text: string
  completed: boolean
}

export interface Comment {
  id: string
  taskId: string
  text: string
  createdAt: string
}

export interface Task {
  id: string
  title: string
  description: string
  columnId: string
  boardId: string
  priority: Priority
  labels: string[]
  subtasks: Subtask[]
  scheduledDate: string | null
  dueDate: string | null
  createdAt: string
  order: number
}

export interface Column {
  id: string
  title: string
  boardId: string
  order: number
}

export interface Board {
  id: string
  name: string
  color: string | null
  order: number
  createdAt: string
}

export interface BoardTemplate {
  id: string
  name: string
  columns: string[]
}

export interface Folder {
  id: string
  name: string
  parentId: string | null
  order: number
}

export interface Note {
  id: string
  title: string
  content?: string
  folderId: string | null
  createdAt: string
  updatedAt: string
}

export type HabitType = 'boolean' | 'measurable'

export type HabitSchedule =
  | { type: 'daily' }
  | { type: 'specific_days'; days: number[] } // 0=Sun, 1=Mon, …6=Sat
  | { type: 'times_per_week'; times: number }
  | { type: 'every_x_days'; days: number } // repeat every N days from startDate/createdAt
  | { type: 'x_per_month'; times: number } // N times per month, any days

export interface Habit {
  id: string
  name: string
  habitType: HabitType
  schedule: HabitSchedule
  target: number
  unit: string
  color: string
  startDate: string | null
  endDate: string | null
  step: number | null
  createdAt: string
}

export interface HabitCompletion {
  id: string
  habitId: string
  date: string // YYYY-MM-DD
  value: number // 1 for boolean, actual number for measurable
}

export interface HabitException {
  id: string
  habitId: string
  date: string // YYYY-MM-DD
  type: 'postponed' | 'skipped'
  note?: string
}
