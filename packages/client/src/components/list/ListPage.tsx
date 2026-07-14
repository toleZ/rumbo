import { useState, useRef, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { format, isPast, isToday } from 'date-fns'
import { getDateLocale } from '../../lib/dateLocale'
import { Plus, Search, Layers, ChevronUp, ChevronDown, Flag, CheckSquare, X, Rows3 } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useTaskStore } from '../../stores/taskStore'
import { useUIStore } from '../../stores/uiStore'
import { useCalendarLoader } from '../layout/DataLoader'
import { PriorityPill } from '../kanban/PriorityPill'
import { TaskModal } from '../kanban/TaskModal'
import { TaskPanel } from '../kanban/TaskPanel'
import { LabelChip } from '../ui/LabelChip'
import { Checkbox } from '../ui/Checkbox'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import type { Priority } from '../../types'

type SortKey = 'title' | 'board' | 'status' | 'priority' | 'due'
type SortDir = 'asc' | 'desc'
type StatusFilter = 'active' | 'done' | 'all'

const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low']
const PRIORITY_ORDER: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

export function ListPage() {
  const { t, i18n } = useTranslation()
  const locale = getDateLocale(i18n.language)
  const { tasks, columns, boards, labels, activeBoardId, setActiveBoard } = useTaskStore(useShallow(s => ({
    tasks: s.tasks,
    columns: s.columns,
    boards: s.boards,
    labels: s.labels,
    activeBoardId: s.activeBoardId,
    setActiveBoard: s.setActiveBoard,
  })))
  const { calendarVisibleBoardIds, setCalendarVisibleBoards, openCreateBoardModal } = useUIStore(useShallow(s => ({
    calendarVisibleBoardIds: s.calendarVisibleBoardIds,
    setCalendarVisibleBoards: s.setCalendarVisibleBoards,
    openCreateBoardModal: s.openCreateBoardModal,
  })))
  const { isLoading } = useCalendarLoader()

  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<Set<Priority>>(new Set())
  const [labelFilter, setLabelFilter] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'due', dir: 'asc' })
  const [boardFilterOpen, setBoardFilterOpen] = useState(false)
  const [priorityFilterOpen, setPriorityFilterOpen] = useState(false)
  const [labelFilterOpen, setLabelFilterOpen] = useState(false)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [showCreateTask, setShowCreateTask] = useState(false)

  const boardFilterRef = useRef<HTMLDivElement>(null)
  const priorityFilterRef = useRef<HTMLDivElement>(null)
  const labelFilterRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boardFilterRef.current && !boardFilterRef.current.contains(e.target as Node)) setBoardFilterOpen(false)
      if (priorityFilterRef.current && !priorityFilterRef.current.contains(e.target as Node)) setPriorityFilterOpen(false)
      if (labelFilterRef.current && !labelFilterRef.current.contains(e.target as Node)) setLabelFilterOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const getBoardName = (boardId: string) => boards.find((b) => b.id === boardId)?.name ?? ''
  const getBoardColor = (boardId: string) => boards.find((b) => b.id === boardId)?.color ?? '#6b7280'
  const getColumnName = (columnId: string) => {
    const col = columns.find((c) => c.id === columnId)
    if (!col) return ''
    return col.title.startsWith('board.col.') ? t(col.title) : col.title
  }
  const isColumnDone = (columnId: string) => columns.find((c) => c.id === columnId)?.isDone ?? false

  const toggleBoardVisibility = (boardId: string) => {
    const next = calendarVisibleBoardIds.includes(boardId)
      ? calendarVisibleBoardIds.filter((id) => id !== boardId)
      : [...calendarVisibleBoardIds, boardId]
    setCalendarVisibleBoards(next)
  }

  const togglePriority = (p: Priority) => {
    setPriorityFilter((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  const toggleLabel = (id: string) => {
    setLabelFilter((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const hasActiveFilters = search.trim() !== '' || priorityFilter.size > 0 || labelFilter.size > 0 || statusFilter !== 'active'
  const clearFilters = () => {
    setSearch('')
    setPriorityFilter(new Set())
    setLabelFilter(new Set())
    setStatusFilter('active')
  }

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase()
    const result = tasks.filter((task) => {
      if (!calendarVisibleBoardIds.includes(task.boardId)) return false
      if (q && !task.title.toLowerCase().includes(q)) return false
      if (priorityFilter.size > 0 && !priorityFilter.has(task.priority ?? 'low')) return false
      if (labelFilter.size > 0 && !task.labels.some((id) => labelFilter.has(id))) return false
      const done = isColumnDone(task.columnId)
      if (statusFilter === 'active' && done) return false
      if (statusFilter === 'done' && !done) return false
      return true
    })

    const dir = sort.dir === 'asc' ? 1 : -1
    return [...result].sort((a, b) => {
      switch (sort.key) {
        case 'title':
          return a.title.localeCompare(b.title) * dir
        case 'board':
          return getBoardName(a.boardId).localeCompare(getBoardName(b.boardId)) * dir
        case 'status':
          return getColumnName(a.columnId).localeCompare(getColumnName(b.columnId)) * dir
        case 'priority':
          return (PRIORITY_ORDER[a.priority ?? 'low'] - PRIORITY_ORDER[b.priority ?? 'low']) * dir
        case 'due': {
          const aTime = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
          const bTime = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
          return (aTime - bTime) * dir
        }
        default:
          return 0
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, columns, boards, calendarVisibleBoardIds, search, priorityFilter, labelFilter, statusFilter, sort])

  const handleSort = (key: SortKey) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
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
  const isEmpty = boards.length === 0

  function SortHeader({ label, sortKey }: { label: string; sortKey: SortKey }) {
    return (
      <th
        className="text-left text-xs font-semibold text-[var(--label-3)] uppercase tracking-wider px-4 py-2.5 select-none cursor-pointer hover:text-[var(--label)] transition-colors"
        onClick={() => handleSort(sortKey)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {sort.key === sortKey && (sort.dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
        </span>
      </th>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-[var(--bg)]">
      <div className="flex items-center justify-between px-6 h-16 border-b border-[var(--sep)] bg-[var(--bg)] sticky top-0 z-10">
        <h2 className="text-lg font-bold text-[var(--label)]">{t('nav.list')}</h2>
        {canCreate && (
          <Button onClick={() => setShowCreateTask(true)} icon={<Plus className="w-4 h-4" />}>
            {t('today.newTask')}
          </Button>
        )}
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-12 h-12 rounded-[var(--radius-xl)] bg-[var(--accent-f)] flex items-center justify-center">
            <Rows3 className="w-6 h-6 text-[var(--accent)]" />
          </div>
          <p className="text-sm font-medium text-[var(--label)]">{t('kanban.noBoards')}</p>
          <Button onClick={openCreateBoardModal}>{t('kanban.noBoardsCta')}</Button>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--label-3)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('list.searchPlaceholder')}
                className="w-full pl-8 pr-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface)] border border-[var(--sep)] text-[var(--label)] placeholder:text-[var(--label-3)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>

            <div className="relative" ref={boardFilterRef}>
              <button
                onClick={() => setBoardFilterOpen((o) => !o)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-[var(--radius-md)] border transition-colors ${
                  boardFilterOpen ? 'bg-[var(--accent-f)] border-[var(--accent)] text-[var(--accent)]' : 'bg-[var(--surface)] border-[var(--sep)] text-[var(--label-2)] hover:bg-[var(--surface-2)]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                {calendarVisibleBoardIds.length === boards.length
                  ? t('calendar.allBoards')
                  : t('calendar.boardsCount', { count: calendarVisibleBoardIds.length })}
              </button>
              {boardFilterOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-52 bg-[var(--surface)] border border-[var(--sep)] rounded-[var(--radius-xl)] shadow-[0_8px_24px_rgba(0,0,0,0.10)] z-50 py-1.5 overflow-hidden">
                  {boards.map((board) => {
                    const visible = calendarVisibleBoardIds.includes(board.id)
                    return (
                      <button
                        key={board.id}
                        onClick={() => toggleBoardVisibility(board.id)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--label)] hover:bg-[var(--surface-2)] transition-colors"
                      >
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: board.color ?? '#6b7280' }} />
                        <span className="flex-1 text-left truncate">{board.name}</span>
                        <Checkbox checked={visible} />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="relative" ref={priorityFilterRef}>
              <button
                onClick={() => setPriorityFilterOpen((o) => !o)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-[var(--radius-md)] border transition-colors ${
                  priorityFilterOpen || priorityFilter.size > 0 ? 'bg-[var(--accent-f)] border-[var(--accent)] text-[var(--accent)]' : 'bg-[var(--surface)] border-[var(--sep)] text-[var(--label-2)] hover:bg-[var(--surface-2)]'
                }`}
              >
                <Flag className="w-3.5 h-3.5" />
                {priorityFilter.size > 0 ? t('list.filterCount', { count: priorityFilter.size }) : t('list.filterPriority')}
              </button>
              {priorityFilterOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-40 bg-[var(--surface)] border border-[var(--sep)] rounded-[var(--radius-xl)] shadow-[0_8px_24px_rgba(0,0,0,0.10)] z-50 py-1.5 overflow-hidden">
                  {PRIORITIES.map((p) => {
                    const active = priorityFilter.has(p)
                    return (
                      <button
                        key={p}
                        onClick={() => togglePriority(p)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[var(--surface-2)] transition-colors"
                      >
                        <span className="flex-1 text-left"><PriorityPill priority={p} /></span>
                        <Checkbox checked={active} />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {labels.length > 0 && (
              <div className="relative" ref={labelFilterRef}>
                <button
                  onClick={() => setLabelFilterOpen((o) => !o)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-[var(--radius-md)] border transition-colors ${
                    labelFilterOpen || labelFilter.size > 0 ? 'bg-[var(--accent-f)] border-[var(--accent)] text-[var(--accent)]' : 'bg-[var(--surface)] border-[var(--sep)] text-[var(--label-2)] hover:bg-[var(--surface-2)]'
                  }`}
                >
                  {labelFilter.size > 0 ? t('list.filterCount', { count: labelFilter.size }) : t('list.filterLabel')}
                </button>
                {labelFilterOpen && (
                  <div className="absolute left-0 top-full mt-1.5 w-48 bg-[var(--surface)] border border-[var(--sep)] rounded-[var(--radius-xl)] shadow-[0_8px_24px_rgba(0,0,0,0.10)] z-50 py-1.5 overflow-hidden max-h-64 overflow-y-auto">
                    {labels.map((l) => {
                      const active = labelFilter.has(l.id)
                      return (
                        <button
                          key={l.id}
                          onClick={() => toggleLabel(l.id)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--label)] hover:bg-[var(--surface-2)] transition-colors"
                        >
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                          <span className="flex-1 text-left truncate">{l.name}</span>
                          <Checkbox checked={active} />
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center rounded-[var(--radius-md)] border border-[var(--sep)] bg-[var(--surface)] p-0.5">
              {(['active', 'done', 'all'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-[var(--radius-sm)] transition-colors ${
                    statusFilter === s ? 'bg-[var(--accent)] text-white' : 'text-[var(--label-2)] hover:bg-[var(--surface-2)]'
                  }`}
                >
                  {t(`list.status${s.charAt(0).toUpperCase()}${s.slice(1)}`)}
                </button>
              ))}
            </div>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-[var(--label-3)] hover:text-[var(--label)] transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                {t('list.clearFilters')}
              </button>
            )}
          </div>

          <div className="bg-[var(--surface)] rounded-[var(--radius-xl)] border border-[var(--sep)] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
            {filteredTasks.length === 0 ? (
              isLoading ? (
                <p className="text-sm text-[var(--label-3)] px-5 py-10 text-center">{t('common.loading')}</p>
              ) : (
                <EmptyState
                  icon={hasActiveFilters ? Search : CheckSquare}
                  title={hasActiveFilters ? t('list.noMatch') : t('list.noTasks')}
                  description={hasActiveFilters ? t('list.noMatchDesc') : t('list.noTasksDesc')}
                />
              )
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="border-b border-[var(--sep)]">
                      <SortHeader label={t('list.columnTitle')} sortKey="title" />
                      <SortHeader label={t('list.columnBoard')} sortKey="board" />
                      <SortHeader label={t('list.columnStatus')} sortKey="status" />
                      <SortHeader label={t('list.columnPriority')} sortKey="priority" />
                      <SortHeader label={t('list.columnDue')} sortKey="due" />
                      <th className="text-left text-xs font-semibold text-[var(--label-3)] uppercase tracking-wider px-4 py-2.5">
                        {t('list.columnLabels')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--sep)]">
                    {filteredTasks.map((task) => {
                      const isOverdue = !!task.dueDate && isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate))
                      const taskLabels = labels.filter((l) => task.labels.includes(l.id))
                      const completedSubtasks = task.subtasks.filter((s) => s.completed).length
                      const totalSubtasks = task.subtasks.length
                      return (
                        <tr
                          key={task.id}
                          onClick={() => handleTaskClick(task.id)}
                          className="hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-3 max-w-xs">
                            <div className="flex items-start gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate text-[var(--label)]">{task.title}</p>
                                {totalSubtasks > 0 && (
                                  <span className="flex items-center gap-1 text-[10px] text-[var(--label-3)] font-medium mt-0.5">
                                    <CheckSquare className="w-3 h-3" />
                                    {completedSubtasks}/{totalSubtasks}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1.5 text-xs text-[var(--label-2)] whitespace-nowrap">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getBoardColor(task.boardId) }} />
                              {getBoardName(task.boardId)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-[var(--label-2)] whitespace-nowrap">{getColumnName(task.columnId)}</span>
                          </td>
                          <td className="px-4 py-3">
                            <PriorityPill priority={task.priority} />
                          </td>
                          <td className="px-4 py-3">
                            {task.dueDate ? (
                              <span className={`flex items-center gap-1 text-xs font-medium whitespace-nowrap ${isOverdue ? 'text-[var(--danger)]' : 'text-[var(--label-2)]'}`}>
                                <Flag className="w-3 h-3" />
                                {format(new Date(task.dueDate), 'MMM d', { locale })}
                              </span>
                            ) : (
                              <span className="text-xs text-[var(--label-3)]">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {taskLabels.length > 0 && (
                              <div className="flex flex-wrap gap-1 max-w-[220px]">
                                {taskLabels.map((l) => (
                                  <LabelChip key={l.id} color={l.color} name={l.name} />
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

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
