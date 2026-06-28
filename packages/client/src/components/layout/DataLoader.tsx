import { useEffect } from 'react'
import { trpc } from '../../lib/trpc'
import { useTaskStore } from '../../stores/taskStore'
import { useNoteStore } from '../../stores/noteStore'
import { useHabitStore } from '../../stores/habitStore'
import type { Board, Column, Task, Label, Note, Folder, Habit, HabitCompletion, HabitException } from '../../types'

function normalizeTask(t: any): Task {
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? '',
    columnId: t.columnId,
    boardId: t.boardId,
    priority: t.priority as Task['priority'],
    scheduledDate: t.scheduledDate ? new Date(t.scheduledDate).toISOString() : null,
    dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
    createdAt: new Date(t.createdAt).toISOString(),
    order: t.order,
    labels: (t.labels ?? []).map((tl: any) => tl.label?.id ?? tl.labelId ?? tl),
    subtasks: (t.subtasks ?? []).map((s: any) => ({ id: s.id, text: s.text, completed: s.completed })),
  }
}

export function DataLoader({ children }: { children: React.ReactNode }) {
  const hydrateTask = useTaskStore((s) => s.hydrate)
  const hydrateNote = useNoteStore((s) => s.hydrate)
  const hydrateHabit = useHabitStore((s) => s.hydrate)
  const utils = trpc.useUtils()

  const boardsQuery = trpc.boards.list.useQuery(undefined, { staleTime: Infinity })
  const notesQuery = trpc.notes.list.useQuery(undefined, { staleTime: Infinity })
  const foldersQuery = trpc.folders.list.useQuery(undefined, { staleTime: Infinity })
  const habitsQuery = trpc.habits.list.useQuery(undefined, { staleTime: Infinity })

  // Load boards list immediately; fetch only the active board's data upfront.
  // Subsequent board navigations are handled by useBoardLoader in KanbanBoard.
  useEffect(() => {
    if (!boardsQuery.data) return

    const boards: Board[] = boardsQuery.data.map((b: any) => ({
      id: b.id, name: b.name, color: b.color ?? null, order: b.order, createdAt: new Date(b.createdAt).toISOString(),
    }))

    if (boards.length === 0) {
      hydrateTask({ boards, columns: [], tasks: [], labels: [], activeBoardId: null })
      return
    }

    // Preserve the board the user already selected (e.g. from a sidebar click that
    // triggered a page change and caused this DataLoader to remount). Fall back to
    // the first board on initial app load when nothing is selected yet.
    const storeState = useTaskStore.getState()
    const currentActiveBoardId = storeState.activeBoardId
    const target = boards.find((b) => b.id === currentActiveBoardId) ?? boards[0]

    // Already hydrated: just sync the boards list — useBoardLoader in KanbanBoard
    // handles per-board column/task data on demand. Skipping the full fetch
    // prevents redundant network calls on every page navigation (DataLoader remounts
    // on each navigation because AppErrorBoundary key includes `page`).
    if (storeState.isHydrated) {
      useTaskStore.setState((s) => ({ ...s, boards }))
      return
    }

    let cancelled = false

    Promise.all([
      utils.columns.list.fetch({ boardId: target.id }),
      utils.tasks.list.fetch({ boardId: target.id }),
    ]).then(([columnsData, tasksData]) => {
      if (cancelled) return
      const columns: Column[] = columnsData.map((c: any) => ({
        id: c.id, title: c.title, boardId: c.boardId, order: c.order,
      }))
      const tasks: Task[] = []
      const labelMap = new Map<string, Label>()

      for (const t of tasksData) {
        tasks.push(normalizeTask(t))
        ;((t as any).labels ?? []).forEach((tl: any) => {
          if (tl.label) labelMap.set(tl.label.id, { id: tl.label.id, name: tl.label.name, color: tl.label.color })
        })
      }

      // If the user clicked a different board while we were fetching, preserve their selection.
      // useBoardLoader in KanbanBoard will fetch the correct board's data when they navigate there.
      const latestActiveBoardId = useTaskStore.getState().activeBoardId
      hydrateTask({
        boards,
        columns,
        tasks,
        labels: Array.from(labelMap.values()),
        activeBoardId: latestActiveBoardId ?? target.id,
      })
    }).catch((err) => {
      console.error('[DataLoader] Failed to load initial board data:', err)
    })

    return () => { cancelled = true }
  }, [boardsQuery.data])

  useEffect(() => {
    if (!notesQuery.data || !foldersQuery.data) return
    const notes: Note[] = notesQuery.data.map((n: any) => ({
      id: n.id, title: n.title, folderId: n.folderId ?? null, order: n.order ?? 0,
      createdAt: new Date(n.createdAt).toISOString(), updatedAt: new Date(n.updatedAt).toISOString(),
    }))
    const folders: Folder[] = foldersQuery.data.map((f: any) => ({
      id: f.id, name: f.name, parentId: f.parentId ?? null, order: f.order ?? 0,
    }))
    hydrateNote({ notes, folders })
  }, [notesQuery.data, foldersQuery.data])

  useEffect(() => {
    if (!habitsQuery.data) return
    const habits: Habit[] = habitsQuery.data.map((h: any) => ({
      id: h.id, name: h.name, habitType: h.habitType as Habit['habitType'],
      schedule: h.schedule as Habit['schedule'], target: h.target, unit: h.unit ?? '',
      color: h.color ?? '#3b82f6', createdAt: new Date(h.createdAt).toISOString(),
      startDate: h.startDate ?? null, endDate: h.endDate ?? null, step: h.step ?? null,
    }))
    const completions: HabitCompletion[] = habitsQuery.data.flatMap((h: any) =>
      (h.completions ?? []).map((c: any) => ({ id: c.id, habitId: h.id, date: c.date, value: c.value }))
    )
    const exceptions: HabitException[] = habitsQuery.data.flatMap((h: any) =>
      (h.exceptions ?? []).map((e: any) => ({ id: e.id, habitId: h.id, date: e.date, type: e.type, note: e.note ?? undefined }))
    )
    hydrateHabit({ habits, completions, exceptions })
  }, [habitsQuery.data])

  return <>{children}</>
}

export function useBoardLoader(boardId: string | null) {
  const hydrateBoard = useTaskStore((s) => s.hydrateBoard)

  const columnsQuery = trpc.columns.list.useQuery(
    { boardId: boardId! },
    { enabled: !!boardId, staleTime: 30_000 }
  )
  const tasksQuery = trpc.tasks.list.useQuery(
    { boardId: boardId! },
    { enabled: !!boardId, staleTime: 30_000 }
  )

  useEffect(() => {
    if (!columnsQuery.data || !tasksQuery.data || !boardId) return

    const columns: Column[] = columnsQuery.data.map((c: any) => ({
      id: c.id, title: c.title, boardId: c.boardId, order: c.order,
    }))

    const tasks: Task[] = tasksQuery.data.map((t: any) => normalizeTask(t))

    const labelMap = new Map<string, Label>()
    tasksQuery.data.forEach((t: any) => {
      ;(t.labels ?? []).forEach((tl: any) => {
        if (tl.label) labelMap.set(tl.label.id, { id: tl.label.id, name: tl.label.name, color: tl.label.color })
      })
    })

    hydrateBoard(boardId, columns, tasks)

    useTaskStore.setState((state) => ({
      labels: [...state.labels.filter((l) => !labelMap.has(l.id)), ...Array.from(labelMap.values())],
    }))
  }, [columnsQuery.data, tasksQuery.data, boardId])

  return { isLoading: columnsQuery.isLoading || tasksQuery.isLoading }
}

// Fetches all tasks and columns across every board the user owns.
// Called by CalendarPage on mount so the calendar always shows a complete picture
// and the task-creation modal can list columns for any board.
export function useCalendarLoader() {
  const hydrateAllBoards = useTaskStore((s) => s.hydrateAllBoards)

  const allColumnsQuery = trpc.columns.listAll.useQuery(undefined, {
    staleTime: 30_000,
  })
  const allTasksQuery = trpc.tasks.listAll.useQuery(undefined, {
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!allColumnsQuery.data) return
    const incoming: Column[] = allColumnsQuery.data.map((c: any) => ({
      id: c.id, title: c.title, boardId: c.boardId, order: c.order,
    }))
    // Merge columns into the store without wiping any already-loaded slice
    useTaskStore.setState((state) => {
      const incomingIds = new Set(incoming.map((c) => c.id))
      return {
        columns: [...state.columns.filter((c) => !incomingIds.has(c.id)), ...incoming],
      }
    })
  }, [allColumnsQuery.data])

  useEffect(() => {
    if (!allTasksQuery.data) return
    const tasks: Task[] = allTasksQuery.data.map((t: any) => normalizeTask(t))

    // Merge labels from all boards into the store
    const labelMap = new Map<string, Label>()
    allTasksQuery.data.forEach((t: any) => {
      ;(t.labels ?? []).forEach((tl: any) => {
        if (tl.label) labelMap.set(tl.label.id, { id: tl.label.id, name: tl.label.name, color: tl.label.color })
      })
    })
    useTaskStore.setState((state) => ({
      labels: [...state.labels.filter((l) => !labelMap.has(l.id)), ...Array.from(labelMap.values())],
    }))

    hydrateAllBoards(tasks)
  }, [allTasksQuery.data])

  return { isLoading: allColumnsQuery.isLoading || allTasksQuery.isLoading }
}
