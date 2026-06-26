import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format, isToday, isPast, isBefore, isAfter, startOfDay, endOfDay, addDays, isWithinInterval } from 'date-fns'
import { es as esLocale, enUS } from 'date-fns/locale'
import { AlertTriangle, Calendar, CheckCircle2, Plus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useTaskStore } from '../../stores/taskStore'
import { useUIStore } from '../../stores/uiStore'
import { TaskPanel } from '../kanban/TaskPanel'
import { TaskModal } from '../kanban/TaskModal'
import type { Task } from '../../types'

const DONE_KEYWORDS = ['done', 'hecho', 'completed', 'finished', 'cerrado', 'terminado', 'complete', 'listo', 'desplegado', 'deployed']

function isDoneColumn(title: string) {
  return DONE_KEYWORDS.includes(title.trim().toLowerCase())
}

function isActiveToday(t: Task): boolean {
  const today = new Date()
  const s = t.scheduledDate ? new Date(t.scheduledDate) : null
  const d = t.dueDate ? new Date(t.dueDate) : null
  if (s && d) return !isBefore(today, startOfDay(s)) && !isAfter(today, endOfDay(d))
  if (s) return isToday(s)
  if (d) return isToday(d)
  return false
}

function isOverdueTask(t: Task): boolean {
  return !!t.dueDate && isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate))
}

export function TodayPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'es' ? esLocale : enUS
  const { tasks, columns, boards, activeBoardId, setActiveBoard } = useTaskStore(useShallow(s => ({
    tasks: s.tasks,
    columns: s.columns,
    boards: s.boards,
    activeBoardId: s.activeBoardId,
    setActiveBoard: s.setActiveBoard,
  })))
  const openCreateBoardModal = useUIStore(s => s.openCreateBoardModal)
  const now = new Date()

  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [showCreateTask, setShowCreateTask] = useState(false)

  const doneColumnIds = new Set(columns.filter((c) => isDoneColumn(c.title)).map((c) => c.id))
  const activeTasks = tasks.filter((t) => (t.scheduledDate || t.dueDate) && !doneColumnIds.has(t.columnId))

  const overdue = activeTasks
    .filter(isOverdueTask)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())

  const dueToday = activeTasks.filter((t) => !isOverdueTask(t) && isActiveToday(t))

  const upcoming = activeTasks
    .filter((t) => {
      if (isOverdueTask(t) || isActiveToday(t)) return false
      const start = t.scheduledDate ? new Date(t.scheduledDate) : new Date(t.dueDate!)
      return !isPast(start) && !isToday(start) && isWithinInterval(start, { start: now, end: addDays(now, 7) })
    })
    .sort((a, b) => {
      const aDate = a.scheduledDate ?? a.dueDate!
      const bDate = b.scheduledDate ?? b.dueDate!
      return new Date(aDate).getTime() - new Date(bDate).getTime()
    })

  const getColumnName = (columnId: string) => {
    const col = columns.find((c) => c.id === columnId)
    if (!col) return ''
    return col.title.startsWith('board.col.') ? t(col.title) : col.title
  }

  const handleTaskClick = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (task?.boardId) setActiveBoard(task.boardId)
    setOpenTaskId(taskId)
  }

  const defaultCreateColumn = (() => {
    const boardId = activeBoardId ?? boards[0]?.id
    return columns
      .filter((c) => c.boardId === boardId)
      .sort((a, b) => a.order - b.order)[0] ?? null
  })()

  const canCreate = boards.length > 0 && defaultCreateColumn !== null

  const renderSection = (title: string, icon: React.ReactNode, items: typeof tasks, accent: string) => (
    <div className="mb-8">
      <h3 className={`text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2 ${accent}`}>
        {icon} {title}{items.length > 0 ? ` (${items.length})` : ''}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--label-3)] ml-5">{t('today.nothingHere')}</p>
      ) : (
        <div className="bg-[var(--surface)] rounded-[12px] border border-[var(--sep)] shadow-[0_1px_3px_rgba(0,0,0,0.06)] divide-y divide-[var(--sep)]">
          {items.map((task) => (
            <button
              key={task.id}
              type="button"
              className="w-full flex items-center justify-between py-3 px-4 hover:bg-[var(--surface-2)] transition-colors text-left first:rounded-t-[12px] last:rounded-b-[12px]"
              onClick={() => handleTaskClick(task.id)}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--label)] truncate">{task.title}</p>
                <p className="text-xs text-[var(--label-3)] mt-0.5">
                  {getColumnName(task.columnId)}
                  {(task.scheduledDate || task.dueDate) && ' · '}
                  {task.scheduledDate && task.dueDate
                    ? `${format(new Date(task.scheduledDate), 'MMM d', { locale })} → ${format(new Date(task.dueDate), 'MMM d', { locale })}`
                    : task.scheduledDate
                      ? format(new Date(task.scheduledDate), 'MMM d', { locale })
                      : task.dueDate
                        ? format(new Date(task.dueDate), 'MMM d', { locale })
                        : null}
                </p>
              </div>
              <PriorityBadge priority={task.priority} />
            </button>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="h-full overflow-y-auto bg-[var(--bg)]">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[var(--label)] mb-1">{t('today.title')}</h1>
            <p className="text-sm text-[var(--label-2)]">{format(now, 'EEEE, MMMM d, yyyy', { locale })}</p>
          </div>
          {canCreate && (
            <button
              onClick={() => setShowCreateTask(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-h)] transition-colors active:scale-[0.97] transition-[background-color,transform] shrink-0"
            >
              <Plus className="w-4 h-4" />
              {t('today.newTask')}
            </button>
          )}
        </div>

        {renderSection(t('today.overdue'), <AlertTriangle className="w-3.5 h-3.5" />, overdue, 'text-[var(--danger)]')}
        {renderSection(t('today.dueToday'), <CheckCircle2 className="w-3.5 h-3.5" />, dueToday, 'text-[var(--accent)]')}
        {renderSection(t('today.upcoming7'), <Calendar className="w-3.5 h-3.5" />, upcoming, 'text-[var(--label-3)]')}

        {boards.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm text-[var(--label-3)] mb-3">{t('today.noBoards')}</p>
            <button
              onClick={openCreateBoardModal}
              className="text-sm text-[var(--accent)] hover:underline"
            >
              {t('today.createFirstBoard')}
            </button>
          </div>
        )}
      </div>

      {showCreateTask && defaultCreateColumn && (
        <TaskModal
          task={null}
          columnId={defaultCreateColumn.id}
          boardId={defaultCreateColumn.boardId}
          showBoardPicker
          onClose={() => setShowCreateTask(false)}
        />
      )}

      {openTaskId && (
        <TaskPanel
          taskId={openTaskId}
          onClose={() => setOpenTaskId(null)}
        />
      )}
    </div>
  )
}

function PriorityBadge({ priority }: { priority?: string | null }) {
  const { t } = useTranslation()
  const styles: Record<string, string> = {
    urgent: 'bg-[rgba(255,59,48,0.10)] text-[var(--danger)]',
    high:   'bg-[rgba(255,149,0,0.10)] text-[var(--warning)]',
    medium: 'bg-[var(--surface-2)] text-[var(--label-3)]',
    low:    'bg-[var(--surface-2)] text-[var(--label-3)]',
  }
  const cls = styles[priority ?? 'low'] ?? styles.low
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-[6px] ml-3 shrink-0 ${cls}`}>
      {priority ? t(`priority.${priority}`) : priority}
    </span>
  )
}
