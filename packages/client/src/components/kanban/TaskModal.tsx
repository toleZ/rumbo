import { useState, useRef, useEffect } from 'react'
import { X, Kanban } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useShallow } from 'zustand/react/shallow'
import { useTaskStore } from '../../stores/taskStore'
import { trpc } from '../../lib/trpc'
import toast from 'react-hot-toast'
import type { Task, Priority } from '../../types'
import { DatePicker } from './DatePicker'
import { Button } from '../ui/Button'

interface TaskModalProps {
  task: Task | null
  columnId: string
  boardId?: string
  showBoardPicker?: boolean
  onClose: () => void
  initialDueDate?: string
}

// Selected state uses each priority's semantic tone (mirrors PriorityPill)
// so the choice reads at a glance instead of four identical violet pills.
const PRIORITIES: { value: Priority; fg: string; bg: string }[] = [
  { value: 'low',    fg: 'var(--label-2)', bg: 'var(--surface-3)' },
  { value: 'medium', fg: 'var(--accent-h)', bg: 'var(--accent-f)' },
  { value: 'high',   fg: 'var(--warning)', bg: 'var(--mod-notes-f)' },
  { value: 'urgent', fg: 'var(--danger)',  bg: 'rgba(255,59,48,0.12)' },
]

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

// Shared field classes — the auth-page focus choreography: label tints toward
// the accent, leading ring fades in via transition-shadow.
const labelCls = 'block text-sm font-medium text-[var(--label)] mb-1.5 transition-colors duration-[160ms] group-focus-within:text-[var(--accent-h)]'
const inputCls = 'w-full px-3 py-2.5 text-sm rounded-[var(--radius-lg)] bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label)] placeholder:text-[var(--label-3)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-shadow duration-[160ms]'

export function TaskModal({ task, columnId, boardId: boardIdProp, showBoardPicker = false, onClose, initialDueDate }: TaskModalProps) {
  const { t } = useTranslation()
  const { boards, columns, activeBoardId } = useTaskStore(useShallow(s => ({ boards: s.boards, columns: s.columns, activeBoardId: s.activeBoardId })))

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 animate-overlay-in" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-modal-title"
        className="w-full max-w-md bg-[var(--surface)] rounded-[var(--radius-2xl)] shadow-[var(--shadow-xl)] border border-[var(--sep)] overflow-hidden animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Module identity hairline */}
        <div className="h-1 bg-[var(--mod-tasks)]" aria-hidden="true" />

        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] bg-[var(--mod-tasks-f)]">
                <Kanban className="h-4 w-4 text-[var(--mod-tasks)]" strokeWidth={2.25} />
              </span>
              <h3 id="task-modal-title" className="text-base font-semibold text-[var(--label)]">{t('task.new')}</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--surface-2)] transition-[background-color,transform] duration-[160ms] active:scale-90"
            >
              <X className="w-4 h-4 text-[var(--label-3)]" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 stagger-children">
            {showBoardPicker && (
              <div className="flex gap-3 pb-1 border-b border-[var(--sep)]">
                <div className="flex-1 group">
                  <label className="block text-xs font-medium text-[var(--label-3)] mb-1.5 uppercase tracking-wide transition-colors duration-[160ms] group-focus-within:text-[var(--accent-h)]">{t('task.board')}</label>
                  <div className="relative">
                    {selectedBoard?.color && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full pointer-events-none" style={{ backgroundColor: selectedBoard.color }} />
                    )}
                    <select
                      value={selectedBoardId}
                      onChange={(e) => handleBoardChange(e.target.value)}
                      className={`w-full py-2.5 pr-3 text-sm rounded-[var(--radius-lg)] bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-shadow duration-[160ms] appearance-none ${selectedBoard?.color ? 'pl-8' : 'pl-3'}`}
                    >
                      {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex-1 group">
                  <label className="block text-xs font-medium text-[var(--label-3)] mb-1.5 uppercase tracking-wide transition-colors duration-[160ms] group-focus-within:text-[var(--accent-h)]">{t('task.column')}</label>
                  <select
                    value={selectedColumnId}
                    onChange={(e) => setSelectedColumnId(e.target.value)}
                    disabled={boardColumns.length === 0}
                    className="w-full px-3 py-2.5 text-sm rounded-[var(--radius-lg)] bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-shadow duration-[160ms] disabled:opacity-50"
                  >
                    {boardColumns.length === 0
                      ? <option value="">{t('task.noColumns')}</option>
                      : boardColumns.map((c) => <option key={c.id} value={c.id}>{c.title.startsWith('board.col.') ? t(c.title) : c.title}</option>)
                    }
                  </select>
                </div>
              </div>
            )}

            <div className="group">
              <label className={labelCls}>{t('task.title')}</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
                className={inputCls}
              />
            </div>
            <div className="group">
              <label className={labelCls}>{t('task.description')}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className={`${inputCls} resize-none`}
              />
            </div>
            <div className="group">
              <label className={labelCls}>{t('task.priority')}</label>
              <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label={t('task.priority')}>
                {PRIORITIES.map(({ value, fg, bg }) => {
                  const selected = priority === value
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setPriority(value)}
                      className={`px-2 py-2 text-xs font-semibold rounded-[var(--radius-md)] border transition-[background-color,border-color,color,transform] duration-[160ms] active:scale-[0.95] ${
                        selected ? 'animate-check-pop' : 'border-[var(--sep)] text-[var(--label-2)] hover:bg-[var(--surface-2)]'
                      }`}
                      style={selected ? { backgroundColor: bg, color: fg, borderColor: fg } : undefined}
                    >
                      {t(`priority.${value}`)}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1 group">
                <label className={labelCls}>{t('task.scheduledDate')}</label>
                <DatePicker
                  value={scheduledDate}
                  onChange={setScheduledDate}
                  placeholder={t('task.selectScheduledDate')}
                />
              </div>
              <div className="flex-1 group">
                <label className={labelCls}>{t('task.dueDate')}</label>
                <DatePicker
                  value={dueDate}
                  onChange={setDueDate}
                  placeholder={t('task.selectDate')}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={onClose} className="text-[var(--label)]">
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={createTaskMutation.isPending || (showBoardPicker && (!selectedBoardId || !selectedColumnId))}
                loading={createTaskMutation.isPending}
              >
                {createTaskMutation.isPending ? t('task.creating') : t('common.create')}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
