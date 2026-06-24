import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { X, Plus } from 'lucide-react'
import { useTaskStore } from '../../stores/taskStore'
import { trpc } from '../../lib/trpc'
import toast from 'react-hot-toast'
import type { Priority } from '../../types'

function normalizeTask(t: any) {
  return {
    id: t.id, title: t.title, description: t.description ?? '',
    columnId: t.columnId, boardId: t.boardId,
    priority: t.priority as Priority,
    scheduledDate: t.scheduledDate ? new Date(t.scheduledDate).toISOString() : null,
    dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
    createdAt: new Date(t.createdAt).toISOString(),
    order: t.order,
    labels: (t.labels ?? []).map((tl: any) => tl.label?.id ?? tl.labelId ?? tl),
    subtasks: (t.subtasks ?? []).map((s: any) => ({ id: s.id, text: s.text, completed: s.completed })),
  }
}

export function QuickAddTask() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const { columns, activeBoardId } = useTaskStore()
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, open)

  const createTaskMutation = trpc.tasks.create.useMutation({
    onSuccess: (data) => {
      useTaskStore.setState((s) => ({ tasks: [...s.tasks, normalizeTask(data)] }))
      setTitle('')
      setOpen(false)
      toast.success(t('quickAdd.taskAdded'))
    },
    onError: () => toast.error(t('quickAdd.failedCreate')),
  })

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') { e.preventDefault(); setOpen(true) }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    const boardColumns = columns.filter((c) => c.boardId === activeBoardId)
    const firstColumn = boardColumns.sort((a, b) => a.order - b.order)[0]
    if (!firstColumn || !activeBoardId) {
      toast.error(t('quickAdd.noBoardOrColumn'))
      return
    }
    createTaskMutation.mutate({ title: title.trim(), description: '', columnId: firstColumn.id, boardId: activeBoardId, priority: 'medium', dueDate: null })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/30 flex items-start justify-center pt-[20vh] z-50" onClick={() => setOpen(false)}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-add-title"
        className="w-full max-w-lg bg-[var(--surface)] rounded-[14px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-[var(--sep)] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <span id="quick-add-title" className="text-sm font-medium text-[var(--label)]">{t('quickAdd.title')}</span>
          <button onClick={() => setOpen(false)} className="p-1 rounded-[6px] hover:bg-[var(--surface-2)] transition-colors">
            <X className="w-4 h-4 text-[var(--label-3)]" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('quickAdd.placeholder')}
            autoFocus
            className="flex-1 px-3 py-2.5 text-sm rounded-[10px] border border-[var(--sep)] bg-[var(--surface-2)] text-[var(--label)] placeholder:text-[var(--label-3)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          <button
            type="submit"
            disabled={createTaskMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-2 bg-[var(--accent)] text-white text-sm font-medium rounded-[10px] hover:bg-[var(--accent-h)] transition-[background-color,transform] duration-[160ms] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            {t('quickAdd.add')}
          </button>
        </form>
      </div>
    </div>
  )
}
