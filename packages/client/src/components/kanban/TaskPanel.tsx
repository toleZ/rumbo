import { useState, useRef, useEffect } from 'react'
import { X, Plus, Trash2, CheckSquare, Square, MessageSquare, Tag } from 'lucide-react'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { formatDistanceToNow } from 'date-fns'
import { es as esLocale, enUS } from 'date-fns/locale'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { useTaskStore } from '../../stores/taskStore'
import { useReminderStore } from '../../stores/reminderStore'
import { trpc } from '../../lib/trpc'
import toast from 'react-hot-toast'
import type { Priority } from '../../types'
import { DatePicker } from './DatePicker'
import { ReminderSection } from './ReminderSection'
import { PriorityPill } from './PriorityPill'

const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent']

const LABEL_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
]

export function TaskPanel({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'es' ? esLocale : enUS
  const { tasks, columns, labels, updateTask, deleteTask, toggleSubtask, updateSubtask, deleteSubtask } = useTaskStore(useShallow(s => ({
    tasks: s.tasks,
    columns: s.columns,
    labels: s.labels,
    updateTask: s.updateTask,
    deleteTask: s.deleteTask,
    toggleSubtask: s.toggleSubtask,
    updateSubtask: s.updateSubtask,
    deleteSubtask: s.deleteSubtask,
  })))
  const task = tasks.find((t) => t.id === taskId)
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(panelRef)

  // Opening the task is the natural "I've seen this reminder" moment — clear
  // its highlighted bell state on the board.
  useEffect(() => {
    useReminderStore.getState().clearDue(taskId)
  }, [taskId])

  const utils = trpc.useUtils()
  const commentsQuery = trpc.tasks.comments.useQuery({ taskId })
  const taskComments = commentsQuery.data ?? []
  // Authoritative source of this board's labels, including ones not yet attached
  // to any task (e.g. created via the AI assistant) — the store only holds
  // labels hydrated from existing tasks, so unassigned labels would be invisible.
  const boardLabelsQuery = trpc.labels.list.useQuery(
    { boardId: task?.boardId ?? '' },
    { enabled: !!task, staleTime: 30_000 },
  )

  const [newSubtask, setNewSubtask] = useState('')
  const [newComment, setNewComment] = useState('')
  const [showLabelPanel, setShowLabelPanel] = useState(false)
  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[5])

  const updateTaskMutation = trpc.tasks.update.useMutation({
    onError: () => toast.error(t('task.failedSave')),
  })

  const deleteTaskMutation = trpc.tasks.delete.useMutation({
    onError: (_, __, ctx: any) => {
      if (ctx?.snapshot) {
        useTaskStore.setState((s) => ({ tasks: [...s.tasks, ctx.snapshot] }))
      }
      toast.error(t('task.failedDelete'))
    },
  })

  const createSubtaskMutation = trpc.subtasks.create.useMutation({
    onSuccess: (data) => {
      useTaskStore.setState((s) => ({
        tasks: s.tasks.map((t) =>
          t.id === taskId
            ? { ...t, subtasks: [...t.subtasks, { id: data.id, text: data.text, completed: data.completed }] }
            : t
        ),
      }))
    },
    onError: () => toast.error(t('task.failedAddSubtask')),
  })

  const updateSubtaskMutation = trpc.subtasks.update.useMutation({
    onError: () => toast.error(t('task.failedUpdateSubtask')),
  })

  const deleteSubtaskMutation = trpc.subtasks.delete.useMutation({
    onError: () => toast.error(t('task.failedDeleteSubtask')),
  })

  const createCommentMutation = trpc.comments.create.useMutation({
    onSuccess: () => utils.tasks.comments.invalidate({ taskId }),
    onError: () => toast.error(t('task.failedPostComment')),
  })

  const deleteCommentMutation = trpc.comments.delete.useMutation({
    onError: () => toast.error(t('task.failedDeleteComment')),
  })

  const createLabelMutation = trpc.labels.create.useMutation({
    onSuccess: (data) => {
      useTaskStore.setState((s) => ({
        labels: [...s.labels, { id: data.id, name: data.name, color: data.color }],
      }))
      if (task) utils.labels.list.invalidate({ boardId: task.boardId })
      handleToggleLabel(data.id, true)
      setNewLabelName('')
      setNewLabelColor(LABEL_COLORS[5])
    },
    onError: () => toast.error(t('task.failedCreateLabel')),
  })

  if (!task) return null

  // This board's labels, straight from the server (covers unassigned labels too).
  const boardLabels = boardLabelsQuery.data ?? []
  const findLabel = (id: string) => boardLabels.find((l) => l.id === id) ?? labels.find((l) => l.id === id)

  const completedSubtasks = task.subtasks.filter((s) => s.completed).length
  const totalSubtasks = task.subtasks.length
  const progress = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0

  const handleToggleLabel = (labelId: string, forceAdd = false) => {
    const isAssigned = task.labels.includes(labelId)
    const newIds = forceAdd || !isAssigned
      ? [...task.labels, labelId]
      : task.labels.filter((id) => id !== labelId)
    const snapshot = [...task.labels]
    updateTask(task.id, { labels: newIds })
    updateTaskMutation.mutate({ id: task.id, labelIds: newIds }, {
      onError: () => {
        updateTask(task.id, { labels: snapshot })
        toast.error(t('task.failedUpdateLabels'))
      },
    })
  }

  const handleToggleSubtask = (subtaskId: string) => {
    const subtask = task.subtasks.find((s) => s.id === subtaskId)
    if (!subtask) return
    const wasCompleted = subtask.completed
    toggleSubtask(task.id, subtaskId)
    updateSubtaskMutation.mutate({ id: subtaskId, completed: !wasCompleted }, {
      onError: () => toggleSubtask(task.id, subtaskId),
    })
  }

  const handleSubtaskBlur = (subtaskId: string, text: string) => {
    if (text.trim()) {
      updateSubtaskMutation.mutate({ id: subtaskId, text: text.trim() })
    }
  }

  const handleDeleteSubtask = (subtaskId: string) => {
    const snapshot = [...task.subtasks]
    deleteSubtask(task.id, subtaskId)
    deleteSubtaskMutation.mutate({ id: subtaskId }, {
      onError: () => {
        useTaskStore.setState((s) => ({
          tasks: s.tasks.map((t) => t.id === task.id ? { ...t, subtasks: snapshot } : t),
        }))
      },
    })
  }

  const handleDeleteComment = (commentId: string) => {
    deleteCommentMutation.mutate({ id: commentId }, {
      onSuccess: () => utils.tasks.comments.invalidate({ taskId }),
    })
  }

  const handleDeleteTask = () => {
    const taskSnapshot = { ...task }
    deleteTask(task.id)
    onClose()
    deleteTaskMutation.mutate({ id: task.id }, {
      onError: () => {
        useTaskStore.setState((s) => ({ tasks: [...s.tasks, taskSnapshot] }))
      },
    })
  }

  const inputCls = 'w-full px-3 py-2.5 text-sm rounded-[10px] bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label)] placeholder:text-[var(--label-3)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]'
  const selectCls = 'w-full px-3 py-2.5 text-sm rounded-[10px] bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]'
  const sectionLabel = 'text-xs font-semibold uppercase tracking-wider text-[var(--label-3)] flex items-center gap-1.5'

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="bg-black/30 absolute inset-0 animate-overlay-in" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-panel-title"
        className="relative w-full max-w-lg bg-[var(--surface)] border-l border-[var(--sep)] shadow-[0_0_40px_rgba(0,0,0,0.10)] h-full overflow-y-auto animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[var(--surface)] border-b border-[var(--sep)] px-6 py-4 flex items-center justify-between z-10">
          <h3 id="task-panel-title" className="text-base font-semibold text-[var(--label)] truncate">{t('task.details')}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-[8px] hover:bg-[var(--surface-2)] transition-colors"
          >
            <X className="w-4 h-4 text-[var(--label-3)]" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Title */}
          <input
            type="text"
            value={task.title}
            onChange={(e) => updateTask(task.id, { title: e.target.value })}
            onBlur={(e) => {
              if (e.target.value.trim()) {
                updateTaskMutation.mutate({ id: task.id, title: e.target.value.trim() })
              }
            }}
            className="w-full text-xl font-bold bg-transparent text-[var(--label)] focus:outline-none border-b border-[var(--sep)] hover:border-[var(--accent)] focus:border-[var(--accent)] pb-1 transition-colors"
          />

          <PriorityPill priority={task.priority} />

          {/* Description */}
          <div>
            <label className={`${sectionLabel} mb-1.5`}>{t('task.description')}</label>
            <textarea
              value={task.description}
              onChange={(e) => updateTask(task.id, { description: e.target.value })}
              onBlur={(e) => updateTaskMutation.mutate({ id: task.id, description: e.target.value })}
              rows={3}
              className={`${inputCls} resize-none`}
              placeholder={t('task.descriptionPlaceholder')}
            />
          </div>

          {/* Priority */}
          <div>
            <label className={`${sectionLabel} mb-1.5`}>{t('task.priority')}</label>
            <select
              value={task.priority}
              onChange={(e) => {
                const priority = e.target.value as Priority
                const snapshot = task.priority
                updateTask(task.id, { priority })
                updateTaskMutation.mutate({ id: task.id, priority }, {
                  onError: () => updateTask(task.id, { priority: snapshot }),
                })
              }}
              className={selectCls}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{t(`priority.${p}`)}</option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={`${sectionLabel} mb-1.5`}>{t('task.scheduledDate')}</label>
              <DatePicker
                value={task.scheduledDate ?? ''}
                onChange={(iso) => {
                  const scheduledDate = iso || null
                  const snapshot = task.scheduledDate
                  updateTask(task.id, { scheduledDate })
                  updateTaskMutation.mutate({ id: task.id, scheduledDate: iso || null }, {
                    onError: () => updateTask(task.id, { scheduledDate: snapshot }),
                  })
                }}
                placeholder={t('task.selectScheduledDate')}
              />
            </div>
            <div className="flex-1">
              <label className={`${sectionLabel} mb-1.5`}>{t('task.dueDate')}</label>
              <DatePicker
                value={task.dueDate ?? ''}
                onChange={(iso) => {
                  const dueDate = iso || null
                  const snapshot = task.dueDate
                  updateTask(task.id, { dueDate })
                  updateTaskMutation.mutate({ id: task.id, dueDate: iso || null }, {
                    onError: () => updateTask(task.id, { dueDate: snapshot }),
                  })
                }}
                placeholder={t('task.selectDate')}
              />
            </div>
          </div>

          {/* Column */}
          <div>
            <label className={`${sectionLabel} mb-1.5`}>{t('task.column')}</label>
            <select
              value={task.columnId}
              onChange={(e) => {
                const columnId = e.target.value
                const snapshot = task.columnId
                updateTask(task.id, { columnId })
                updateTaskMutation.mutate({ id: task.id, columnId }, {
                  onError: () => updateTask(task.id, { columnId: snapshot }),
                })
              }}
              className={selectCls}
            >
              {columns.filter((c) => c.boardId === task.boardId).map((c) => (
                <option key={c.id} value={c.id}>{c.title.startsWith('board.col.') ? t(c.title) : c.title}</option>
              ))}
            </select>
          </div>

          {/* Labels */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={sectionLabel}>
                <Tag className="w-3.5 h-3.5" /> {t('task.labels')}
              </label>
              <button
                onClick={() => setShowLabelPanel(!showLabelPanel)}
                className="text-xs text-[var(--accent)] hover:text-[var(--accent-h)]"
              >
                {showLabelPanel ? t('task.labelsDone') : t('task.labelsManage')}
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-2">
              {task.labels.map((labelId) => {
                const label = findLabel(labelId)
                if (!label) return null
                return (
                  <span
                    key={labelId}
                    onClick={() => handleToggleLabel(labelId)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white cursor-pointer opacity-90 hover:opacity-100"
                    style={{ backgroundColor: label.color }}
                  >
                    {label.name}
                    <X className="w-3 h-3" />
                  </span>
                )
              })}
              {task.labels.length === 0 && !showLabelPanel && (
                <span className="text-xs text-[var(--label-3)]">{t('task.noLabels')}</span>
              )}
            </div>

            {showLabelPanel && (
              <div className="border border-[var(--sep)] rounded-[10px] p-3 space-y-3">
                <div className="space-y-1">
                  {boardLabels.map((label) => (
                    <button
                      key={label.id}
                      onClick={() => handleToggleLabel(label.id)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-[8px] text-sm transition-colors ${
                        task.labels.includes(label.id)
                          ? 'bg-[var(--accent-f)]'
                          : 'hover:bg-[var(--surface-2)]'
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: label.color }} />
                      <span className="text-[var(--label)]">{label.name}</span>
                      {task.labels.includes(label.id) && (
                        <CheckSquare className="w-3.5 h-3.5 ml-auto text-[var(--accent)]" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="pt-2 border-t border-[var(--sep)]">
                  <p className="text-xs font-medium text-[var(--label-3)] mb-2">{t('task.newLabel')}</p>
                  <input
                    type="text"
                    value={newLabelName}
                    onChange={(e) => setNewLabelName(e.target.value)}
                    placeholder={t('task.labelNamePlaceholder')}
                    className="w-full px-2 py-1.5 text-sm rounded-[8px] bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label)] placeholder:text-[var(--label-3)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] mb-2"
                  />
                  <div className="flex gap-1.5 flex-wrap mb-2">
                    {LABEL_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setNewLabelColor(c)}
                        aria-label={`Label color ${c}`}
                        aria-pressed={newLabelColor === c}
                        className={`w-5 h-5 rounded-full border-2 transition-all ${
                          newLabelColor === c ? 'border-[var(--label)] scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      if (newLabelName.trim()) {
                        createLabelMutation.mutate({ name: newLabelName.trim(), color: newLabelColor, boardId: task.boardId })
                      }
                    }}
                    disabled={!newLabelName.trim() || createLabelMutation.isPending}
                    className="w-full px-2 py-1.5 text-xs font-semibold text-white bg-[var(--accent)] rounded-[8px] hover:bg-[var(--accent-h)] disabled:opacity-50 transition-colors"
                  >
                    {createLabelMutation.isPending ? t('task.creatingLabel') : t('task.createLabel')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Subtasks */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={sectionLabel}>
                <CheckSquare className="w-3.5 h-3.5" /> {t('task.subtasks')}
              </label>
              {totalSubtasks > 0 && (
                <span className="text-xs text-[var(--label-3)]">{completedSubtasks}/{totalSubtasks}</span>
              )}
            </div>
            {totalSubtasks > 0 && (
              <div className="w-full bg-[var(--surface-3)] rounded-full h-1.5 mb-3">
                <div
                  className="bg-[var(--accent)] h-1.5 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
            <div className="space-y-1.5">
              {task.subtasks.map((s) => (
                <div key={s.id} className="flex items-center gap-2 group">
                  <button onClick={() => handleToggleSubtask(s.id)} className="shrink-0">
                    {s.completed
                      ? <CheckSquare className="w-4 h-4 text-[var(--accent)]" />
                      : <Square className="w-4 h-4 text-[var(--label-3)]" />
                    }
                  </button>
                  <input
                    type="text"
                    value={s.text}
                    onChange={(e) => updateSubtask(task.id, s.id, e.target.value)}
                    onBlur={(e) => handleSubtaskBlur(s.id, e.target.value)}
                    className={`flex-1 text-sm bg-transparent focus:outline-none ${
                      s.completed ? 'text-[var(--label-3)] line-through' : 'text-[var(--label)]'
                    }`}
                  />
                  <button
                    onClick={() => handleDeleteSubtask(s.id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded-[4px] hover:bg-[var(--surface-2)] transition-opacity"
                  >
                    <Trash2 className="w-3 h-3 text-[var(--label-3)]" />
                  </button>
                </div>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (newSubtask.trim()) {
                  createSubtaskMutation.mutate({ taskId: task.id, text: newSubtask.trim() })
                  setNewSubtask('')
                }
              }}
              className="flex items-center gap-2 mt-2"
            >
              <Plus className="w-4 h-4 text-[var(--label-3)] shrink-0" />
              <input
                type="text"
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                placeholder={t('task.subtaskPlaceholder')}
                disabled={createSubtaskMutation.isPending}
                className="flex-1 text-sm bg-transparent text-[var(--label)] placeholder:text-[var(--label-3)] focus:outline-none disabled:opacity-50"
              />
            </form>
          </div>

          {/* Reminders */}
          <ReminderSection taskId={task.id} />

          {/* Comments */}
          <div>
            <label className={`${sectionLabel} mb-2`}>
              <MessageSquare className="w-3.5 h-3.5" /> {t('task.comments')}
            </label>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (newComment.trim()) {
                  createCommentMutation.mutate({ taskId: task.id, text: newComment.trim() })
                  setNewComment('')
                }
              }}
              className="flex gap-2 mb-3"
            >
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={t('task.commentPlaceholder')}
                className={`${inputCls} flex-1`}
              />
              <button
                type="submit"
                disabled={createCommentMutation.isPending}
                className="px-3 py-2 text-sm font-semibold text-white bg-[var(--accent)] rounded-[10px] hover:bg-[var(--accent-h)] disabled:opacity-50 transition-colors"
              >
                {t('task.post')}
              </button>
            </form>
            <div className="space-y-3">
              {taskComments.map((c) => (
                <div key={c.id} className="flex justify-between items-start group">
                  <div>
                    <p className="text-sm text-[var(--label)]">{c.text}</p>
                    <p className="text-[10px] text-[var(--label-3)] mt-0.5">
                      {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true, locale })}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteComment(c.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-[6px] hover:bg-[var(--surface-2)] transition-opacity"
                  >
                    <Trash2 className="w-3 h-3 text-[var(--label-3)]" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Delete Task */}
          <button
            onClick={handleDeleteTask}
            disabled={deleteTaskMutation.isPending}
            className="w-full py-2.5 text-sm font-medium text-[var(--danger)] hover:bg-[rgba(255,59,48,0.06)] rounded-[10px] transition-colors disabled:opacity-50"
          >
            {t('task.deleteTask')}
          </button>
        </div>
      </div>
    </div>
  )
}
