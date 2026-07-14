import { useShallow } from 'zustand/react/shallow'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { useTaskStore } from '../stores/taskStore'
import { trpc } from '../lib/trpc'
import type { Task } from '../types'

// Backs the top-level task-completion checkbox (TaskCard, ListPage). A board
// only supports "done" if one of its columns is flagged isDone — boards
// without one simply don't get a checkbox, we don't invent a done state.
export function useTaskCompletion() {
  const { t } = useTranslation()
  const { columns, moveTask } = useTaskStore(useShallow((s) => ({ columns: s.columns, moveTask: s.moveTask })))
  const utils = trpc.useUtils()
  const moveMutation = trpc.tasks.move.useMutation({
    onSuccess: (_, vars) => {
      const column = columns.find((c) => c.id === vars.columnId)
      if (column) utils.tasks.list.invalidate({ boardId: column.boardId })
    },
  })

  const hasDoneColumn = (boardId: string) => columns.some((c) => c.boardId === boardId && c.isDone)
  const isDone = (task: Task) => columns.find((c) => c.id === task.columnId)?.isDone ?? false

  const toggleComplete = (task: Task) => {
    const done = isDone(task)
    const target = done
      ? columns.filter((c) => c.boardId === task.boardId && !c.isDone).sort((a, b) => a.order - b.order)[0]
      : columns.find((c) => c.boardId === task.boardId && c.isDone)
    if (!target) return

    const snapshot = { columnId: task.columnId, order: task.order }
    moveTask(task.id, target.id, 0)
    moveMutation.mutate({ taskId: task.id, columnId: target.id, order: 0 }, {
      onError: () => {
        moveTask(task.id, snapshot.columnId, snapshot.order)
        toast.error(t('kanban.failedMove'))
      },
    })
  }

  return { hasDoneColumn, isDone, toggleComplete }
}
