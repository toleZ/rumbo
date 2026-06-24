import { useState, useRef } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useTaskStore } from '../../stores/taskStore'
import { trpc } from '../../lib/trpc'
import toast from 'react-hot-toast'
import type { Task, Priority } from '../../types'
import { DatePicker } from './DatePicker'

interface TaskModalProps {
  task: Task | null
  columnId: string
  boardId?: string
  showBoardPicker?: boolean
  onClose: () => void
  initialDueDate?: string
}

const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent']

function normalizeTask(t: any): Task {
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? '',
    columnId: t.columnId,
    boardId: t.boardId,
    priority: t.priority as Priority,
    scheduledDate: t.scheduledDate ? new Date(t.scheduledDate).toISOString() : null,
    dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
    createdAt: new Date(t.createdAt).toISOString(),
    order: t.order,
    labels: (t.labels ?? []).map((tl: any) => tl.label?.id ?? tl.labelId ?? tl),
    subtasks: (t.subtasks ?? []).map((s: any) => ({ id: s.id, text: s.text, completed: s.completed })),
  }
}

export function TaskModal({ task, columnId, boardId: boardIdProp, showBoardPicker = false, onClose, initialDueDate }: TaskModalProps) {
  const { t } = useTranslation()
  const { boards, columns, activeBoardId } = useTaskStore()

  const initialBoardId = boardIdProp ?? activeBoardId ?? ''
  const [selectedBoardId, setSelectedBoardId] = useState(initialBoardId)
  const [selectedColumnId, setSelectedColumnId] = useState(columnId)

  const [title, setTitle] = useState(task?.title || '')
  const [description, setDescription] = useState(task?.description || '')
  const [priority, setPriority] = useState<Priority>(task?.priority || 'medium')
  const [scheduledDate, setScheduledDate] = useState(task?.scheduledDate || '')
  const [dueDate, setDueDate] = useState(task?.dueDate || initialDueDate || '')
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef)

  const boardColumns = columns
    .filter((c) => c.boardId === selectedBoardId)
    .sort((a, b) => a.order - b.order)

  const handleBoardChange = (newBoardId: string) => {
    setSelectedBoardId(newBoardId)
    const firstCol = columns.filter((c) => c.boardId === newBoardId).sort((a, b) => a.order - b.order)[0]
    setSelectedColumnId(firstCol?.id ?? '')
  }

  const createTaskMutation = trpc.tasks.create.useMutation({
    onSuccess: (data) => {
      useTaskStore.setState((s) => ({ tasks: [...s.tasks, normalizeTask(data)] }))
      toast.success(t('task.created'))
      onClose()
    },
    onError: () => toast.error(t('task.failedCreate')),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const boardId = showBoardPicker ? selectedBoardId : (boardIdProp ?? activeBoardId)
    const column = showBoardPicker ? selectedColumnId : columnId
    if (!title.trim() || !boardId || !column) return
    createTaskMutation.mutate({ title: title.trim(), description, columnId: column, boardId, priority, scheduledDate: scheduledDate || null, dueDate: dueDate || null })
  }

  const selectedBoard = boards.find((b) => b.id === selectedBoardId)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-overlay-in" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-modal-title"
        className="w-full max-w-md bg-[var(--surface)] rounded-[14px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-[var(--sep)] p-6 animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 id="task-modal-title" className="text-base font-semibold text-[var(--label)]">{t('task.new')}</h3>
          <button onClick={onClose} className="p-1.5 rounded-[6px] hover:bg-[var(--surface-2)] transition-colors">
            <X className="w-4 h-4 text-[var(--label-3)]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {showBoardPicker && (
            <div className="flex gap-3 pb-1 border-b border-[var(--sep)]">
              <div className="flex-1">
                <label className="block text-xs font-medium text-[var(--label-3)] mb-1.5 uppercase tracking-wide">{t('task.board')}</label>
                <div className="relative">
                  {selectedBoard?.color && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full pointer-events-none" style={{ backgroundColor: selectedBoard.color }} />
                  )}
                  <select
                    value={selectedBoardId}
                    onChange={(e) => handleBoardChange(e.target.value)}
                    className={`w-full py-2.5 pr-3 text-sm rounded-[10px] bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] appearance-none ${selectedBoard?.color ? 'pl-8' : 'pl-3'}`}
                  >
                    {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-[var(--label-3)] mb-1.5 uppercase tracking-wide">{t('task.column')}</label>
                <select
                  value={selectedColumnId}
                  onChange={(e) => setSelectedColumnId(e.target.value)}
                  disabled={boardColumns.length === 0}
                  className="w-full px-3 py-2.5 text-sm rounded-[10px] bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50"
                >
                  {boardColumns.length === 0
                    ? <option value="">{t('task.noColumns')}</option>
                    : boardColumns.map((c) => <option key={c.id} value={c.id}>{c.title.startsWith('board.col.') ? t(c.title) : c.title}</option>)
                  }
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[var(--label)] mb-1.5">{t('task.title')}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2.5 text-sm rounded-[10px] bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label)] placeholder:text-[var(--label-3)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--label)] mb-1.5">{t('task.description')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 text-sm rounded-[10px] bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label)] placeholder:text-[var(--label-3)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--label)] mb-1.5">{t('task.priority')}</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="w-full px-3 py-2.5 text-sm rounded-[10px] bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{t(`priority.${p}`)}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-[var(--label)] mb-1.5">{t('task.scheduledDate')}</label>
              <DatePicker
                value={scheduledDate}
                onChange={setScheduledDate}
                placeholder={t('task.selectScheduledDate')}
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-[var(--label)] mb-1.5">{t('task.dueDate')}</label>
              <DatePicker
                value={dueDate}
                onChange={setDueDate}
                placeholder={t('task.selectDate')}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[var(--label)] bg-[var(--surface-2)] rounded-[10px] hover:bg-[var(--surface-3)] transition-colors active:scale-[0.97]"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={createTaskMutation.isPending || (showBoardPicker && (!selectedBoardId || !selectedColumnId))}
              className="px-4 py-2 text-sm font-semibold text-white bg-[var(--accent)] rounded-[10px] hover:bg-[var(--accent-h)] disabled:opacity-50 transition-[background-color,transform] duration-[160ms] active:scale-[0.97]"
            >
              {createTaskMutation.isPending ? t('task.creating') : t('common.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
