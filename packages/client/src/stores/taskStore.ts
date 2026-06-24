import { create } from 'zustand'
import type { Task, Column, Label, Board } from '../types'
import { useUIStore } from './uiStore'

const generateId = () => crypto.randomUUID()

interface TaskState {
  tasks: Task[]
  columns: Column[]
  labels: Label[]
  boards: Board[]
  activeBoardId: string | null
  isHydrated: boolean
  hydrate: (data: { boards: Board[]; columns: Column[]; tasks: Task[]; labels: Label[]; activeBoardId: string | null }) => void
  hydrateBoard: (boardId: string, columns: Column[], tasks: Task[]) => void
  // Merge tasks from all boards into the store without wiping any per-board slice.
  hydrateAllBoards: (tasks: Task[]) => void
  addBoard: (name: string, color?: string | null, columnTitles?: string[]) => void
  renameBoard: (id: string, name: string) => void
  updateBoardColor: (id: string, color: string | null) => void
  deleteBoard: (id: string) => void
  setActiveBoard: (id: string) => void
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'order'>) => void
  updateTask: (id: string, updates: Partial<Task>) => void
  deleteTask: (id: string) => void
  moveTask: (taskId: string, toColumnId: string, newOrder: number) => void
  reorderTasks: (columnId: string, taskIds: string[]) => void
  addSubtask: (taskId: string, text: string) => void
  toggleSubtask: (taskId: string, subtaskId: string) => void
  updateSubtask: (taskId: string, subtaskId: string, text: string) => void
  deleteSubtask: (taskId: string, subtaskId: string) => void
  addColumn: (title: string) => void
  updateColumn: (id: string, title: string) => void
  deleteColumn: (id: string) => void
  reorderColumns: (columnIds: string[]) => void
  addLabel: (name: string, color: string) => void
  updateLabel: (id: string, updates: Partial<Label>) => void
  deleteLabel: (id: string) => void
}

export const useTaskStore = create<TaskState>((set) => ({
  tasks: [],
  columns: [],
  labels: [],
  boards: [],
  activeBoardId: null,
  isHydrated: false,

  hydrate: ({ boards, columns, tasks, labels, activeBoardId }) => {
    useUIStore.getState().syncCalendarBoards(boards.map((b) => b.id))
    set({ boards, columns, tasks, labels, activeBoardId, isHydrated: true })
  },

  hydrateBoard: (boardId, columns, tasks) =>
    set((state) => ({
      columns: [...state.columns.filter((c) => c.boardId !== boardId), ...columns],
      tasks: [...state.tasks.filter((t) => t.boardId !== boardId), ...tasks],
    })),

  hydrateAllBoards: (incomingTasks) =>
    set((state) => {
      const incomingIds = new Set(incomingTasks.map((t) => t.id))
      // Keep optimistically-added tasks not yet in server response,
      // replace everything else with the fresh server data.
      const kept = state.tasks.filter((t) => !incomingIds.has(t.id))
      return { tasks: [...kept, ...incomingTasks] }
    }),

  addBoard: (name, color = null, columnTitles) =>
    set((state) => {
      const newBoard: Board = { id: generateId(), name, color: color ?? null, order: state.boards.length, createdAt: new Date().toISOString() }
      const titles = columnTitles || ['board.col.todo', 'board.col.inProgress', 'board.col.done']
      const newColumns: Column[] = titles.map((title, i) => ({ id: generateId(), title, boardId: newBoard.id, order: i }))
      useUIStore.getState().addCalendarBoard(newBoard.id)
      return { boards: [...state.boards, newBoard], columns: [...state.columns, ...newColumns], activeBoardId: newBoard.id }
    }),

  renameBoard: (id, name) => set((state) => ({ boards: state.boards.map((b) => (b.id === id ? { ...b, name } : b)) })),
  updateBoardColor: (id, color) => set((state) => ({ boards: state.boards.map((b) => (b.id === id ? { ...b, color } : b)) })),
  deleteBoard: (id) =>
    set((state) => {
      if (state.boards.length <= 1) return state
      const filtered = state.boards.filter((b) => b.id !== id)
      const newActiveId = state.activeBoardId === id ? filtered[0].id : state.activeBoardId
      useUIStore.getState().removeCalendarBoard(id)
      return {
        boards: filtered,
        columns: state.columns.filter((c) => c.boardId !== id),
        tasks: state.tasks.filter((t) => t.boardId !== id),
        activeBoardId: newActiveId,
      }
    }),
  setActiveBoard: (id) => set({ activeBoardId: id }),

  addTask: (taskData) =>
    set((state) => {
      const tasksInColumn = state.tasks.filter((t) => t.columnId === taskData.columnId)
      const newTask: Task = { ...taskData, id: generateId(), createdAt: new Date().toISOString(), order: tasksInColumn.length }
      return { tasks: [...state.tasks, newTask] }
    }),
  updateTask: (id, updates) => set((state) => ({ tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)) })),
  deleteTask: (id) => set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),
  moveTask: (taskId, toColumnId, newOrder) =>
    set((state) => {
      const task = state.tasks.find((t) => t.id === taskId)
      if (!task) return state
      return { tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, columnId: toColumnId, order: newOrder } : t)) }
    }),
  reorderTasks: (columnId, taskIds) =>
    set((state) => ({
      tasks: state.tasks.map((t) => {
        if (t.columnId === columnId) {
          const newOrder = taskIds.indexOf(t.id)
          if (newOrder !== -1) return { ...t, order: newOrder }
        }
        return t
      }),
    })),

  addSubtask: (taskId, text) =>
    set((state) => ({
      tasks: state.tasks.map((t) => t.id === taskId ? { ...t, subtasks: [...t.subtasks, { id: generateId(), text, completed: false }] } : t),
    })),
  toggleSubtask: (taskId, subtaskId) =>
    set((state) => ({
      tasks: state.tasks.map((t) => t.id === taskId ? { ...t, subtasks: t.subtasks.map((s) => s.id === subtaskId ? { ...s, completed: !s.completed } : s) } : t),
    })),
  updateSubtask: (taskId, subtaskId, text) =>
    set((state) => ({
      tasks: state.tasks.map((t) => t.id === taskId ? { ...t, subtasks: t.subtasks.map((s) => s.id === subtaskId ? { ...s, text } : s) } : t),
    })),
  deleteSubtask: (taskId, subtaskId) =>
    set((state) => ({
      tasks: state.tasks.map((t) => t.id === taskId ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) } : t),
    })),

  addColumn: (title) =>
    set((state) => {
      const boardColumns = state.columns.filter((c) => c.boardId === state.activeBoardId)
      return { columns: [...state.columns, { id: generateId(), title, boardId: state.activeBoardId!, order: boardColumns.length }] }
    }),
  updateColumn: (id, title) => set((state) => ({ columns: state.columns.map((c) => (c.id === id ? { ...c, title } : c)) })),
  deleteColumn: (id) => set((state) => ({ columns: state.columns.filter((c) => c.id !== id), tasks: state.tasks.filter((t) => t.columnId !== id) })),
  reorderColumns: (columnIds) =>
    set((state) => ({
      columns: state.columns.map((c) => {
        const idx = columnIds.indexOf(c.id)
        return idx !== -1 ? { ...c, order: idx } : c
      }),
    })),

  addLabel: (name, color) => set((state) => ({ labels: [...state.labels, { id: generateId(), name, color }] })),
  updateLabel: (id, updates) => set((state) => ({ labels: state.labels.map((l) => (l.id === id ? { ...l, ...updates } : l)) })),
  deleteLabel: (id) =>
    set((state) => ({
      labels: state.labels.filter((l) => l.id !== id),
      tasks: state.tasks.map((t) => ({ ...t, labels: t.labels.filter((lId) => lId !== id) })),
    })),
}))
