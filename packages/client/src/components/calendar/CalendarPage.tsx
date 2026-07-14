import { useTranslation } from 'react-i18next'
import {
  format, getDay,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays,
  isSameMonth, isSameDay, isToday, isBefore, isAfter,
  startOfDay, endOfDay, differenceInCalendarDays,
} from 'date-fns'
import { es as esLocale, enUS } from 'date-fns/locale'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronLeft, ChevronRight, Plus, Layers, CalendarDays } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useTaskStore } from '../../stores/taskStore'
import { useUIStore } from '../../stores/uiStore'
import { TaskModal } from '../kanban/TaskModal'
import { TaskPanel } from '../kanban/TaskPanel'
import { PriorityPill } from '../kanban/PriorityPill'
import { useCalendarLoader } from '../layout/DataLoader'
import { Checkbox } from '../ui/Checkbox'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { useState, useRef, useEffect } from 'react'
import type { Task } from '../../types'

// Returns true if a task is active on a given date (range-aware)
function isTaskOnDate(task: Task, date: Date): boolean {
  const s = task.scheduledDate ? startOfDay(new Date(task.scheduledDate)) : null
  const d = task.dueDate ? endOfDay(new Date(task.dueDate)) : null
  if (s && d) return !isBefore(date, s) && !isAfter(date, d)
  if (s) return isSameDay(s, date)
  if (d) return isSameDay(d, date)
  return false
}

interface TaskBar {
  task: Task
  startIdx: number  // 0–6 within the week
  endIdx: number    // 0–6 within the week
  isStart: boolean  // actual task start falls within this week
  isEnd: boolean    // actual task end falls within this week
  slot: number      // vertical row (for stacking)
}

function getWeekBars(week: Date[], tasks: Task[], visibleBoardIds: string[]): TaskBar[] {
  const weekStart = startOfDay(week[0])
  const weekEnd = endOfDay(week[6])

  const weekTasks = tasks.filter(task => {
    if (!visibleBoardIds.includes(task.boardId)) return false
    const s = task.scheduledDate ? startOfDay(new Date(task.scheduledDate)) : task.dueDate ? startOfDay(new Date(task.dueDate)) : null
    const e = task.dueDate ? endOfDay(new Date(task.dueDate)) : s
    if (!s || !e) return false
    return !isAfter(s, weekEnd) && !isBefore(e, weekStart)
  })

  // Longer spans first, then earlier start
  weekTasks.sort((a, b) => {
    const aS = a.scheduledDate ? new Date(a.scheduledDate) : new Date(a.dueDate!)
    const bS = b.scheduledDate ? new Date(b.scheduledDate) : new Date(b.dueDate!)
    const aE = a.dueDate ? new Date(a.dueDate) : aS
    const bE = b.dueDate ? new Date(b.dueDate) : bS
    const aDur = differenceInCalendarDays(aE, aS)
    const bDur = differenceInCalendarDays(bE, bS)
    if (bDur !== aDur) return bDur - aDur
    return aS.getTime() - bS.getTime()
  })

  const slotOccupancy: { start: number; end: number }[][] = []

  return weekTasks.map(task => {
    const taskStart = task.scheduledDate ? startOfDay(new Date(task.scheduledDate)) : startOfDay(new Date(task.dueDate!))
    const taskEnd = task.dueDate ? endOfDay(new Date(task.dueDate)) : endOfDay(taskStart)

    const visStart = isBefore(taskStart, weekStart) ? weekStart : taskStart
    const visEnd = isAfter(taskEnd, weekEnd) ? weekEnd : taskEnd

    const startIdx = differenceInCalendarDays(visStart, weekStart)
    const endIdx = differenceInCalendarDays(visEnd, weekStart)

    let slot = 0
    while (true) {
      if (!slotOccupancy[slot]) { slotOccupancy[slot] = []; break }
      const conflict = slotOccupancy[slot].some(s => !(endIdx < s.start || startIdx > s.end))
      if (!conflict) break
      slot++
    }
    slotOccupancy[slot].push({ start: startIdx, end: endIdx })

    return {
      task,
      startIdx,
      endIdx,
      isStart: !isBefore(taskStart, weekStart),
      isEnd: !isAfter(taskEnd, weekEnd),
      slot,
    }
  })
}

export function CalendarPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'es' ? esLocale : enUS
  const reducedMotion = useReducedMotion()
  const { tasks, columns, boards, activeBoardId, setActiveBoard } = useTaskStore(useShallow(s => ({
    tasks: s.tasks,
    columns: s.columns,
    boards: s.boards,
    activeBoardId: s.activeBoardId,
    setActiveBoard: s.setActiveBoard,
  })))
  const { calendarView, setCalendarView, calendarDate, setCalendarDate, calendarVisibleBoardIds, setCalendarVisibleBoards } = useUIStore(useShallow(s => ({
    calendarView: s.calendarView,
    setCalendarView: s.setCalendarView,
    calendarDate: s.calendarDate,
    setCalendarDate: s.setCalendarDate,
    calendarVisibleBoardIds: s.calendarVisibleBoardIds,
    setCalendarVisibleBoards: s.setCalendarVisibleBoards,
  })))

  const { isLoading } = useCalendarLoader()

  const currentDate = new Date(calendarDate)

  const [newTaskState, setNewTaskState] = useState<{
    date: string; boardId: string; columnId: string
  } | null>(null)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [boardFilterOpen, setBoardFilterOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!boardFilterOpen) return
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setBoardFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [boardFilterOpen])

  const navigate = (dir: number) => {
    if (calendarView === 'monthly') setCalendarDate((dir > 0 ? addMonths(currentDate, 1) : subMonths(currentDate, 1)).toISOString())
    else if (calendarView === 'weekly') setCalendarDate((dir > 0 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1)).toISOString())
    else setCalendarDate((dir > 0 ? addDays(currentDate, 1) : subDays(currentDate, 1)).toISOString())
  }

  const tasksOnDate = (date: Date) =>
    tasks.filter(t => isTaskOnDate(t, date) && calendarVisibleBoardIds.includes(t.boardId))

  const toggleBoardVisibility = (boardId: string) => {
    const next = calendarVisibleBoardIds.includes(boardId)
      ? calendarVisibleBoardIds.filter((id) => id !== boardId)
      : [...calendarVisibleBoardIds, boardId]
    setCalendarVisibleBoards(next)
  }

  const handleDayClick = (date: Date) => {
    const firstColumn = columns.find((c) => c.boardId === activeBoardId)
    if (!firstColumn || !activeBoardId) return
    setNewTaskState({ date: date.toISOString(), boardId: activeBoardId, columnId: firstColumn.id })
  }

  const handleTaskClick = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation()
    const task = tasks.find((t) => t.id === taskId)
    if (task && task.boardId !== activeBoardId) setActiveBoard(task.boardId)
    setOpenTaskId(taskId)
  }

  const getBoardColor = (boardId: string) => boards.find((b) => b.id === boardId)?.color ?? '#6b7280'
  const getBoardName = (boardId: string) => boards.find((b) => b.id === boardId)?.name ?? ''

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  // Group days into week rows
  const weeks: Date[][] = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))

  const weekStart = startOfWeek(currentDate)
  const weekDays = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) })

  const visibleCount = calendarVisibleBoardIds.length
  const filterLabel =
    visibleCount === 0
      ? t('calendar.noBoards')
      : visibleCount === boards.length
        ? t('calendar.allBoards')
        : t('calendar.boardsCount', { count: visibleCount })

  const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

  const views = [
    { id: 'monthly' as const, label: t('calendar.monthly') },
    { id: 'weekly'  as const, label: t('calendar.weekly') },
    { id: 'daily'   as const, label: t('calendar.daily') },
  ]

  return (
    <div className="h-full flex flex-col bg-[var(--bg)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 h-16 border-b border-[var(--sep)]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-[var(--radius-md)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5 text-[var(--label-2)]" />
          </button>
          <h2 className="text-base font-semibold text-[var(--label)] min-w-[200px] text-center">
            {calendarView === 'daily' ? format(currentDate, 'EEEE, MMMM d, yyyy', { locale }) : format(currentDate, 'MMMM yyyy', { locale })}
          </h2>
          <button
            onClick={() => navigate(1)}
            className="p-1.5 rounded-[var(--radius-md)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
          >
            <ChevronRight className="w-5 h-5 text-[var(--label-2)]" />
          </button>
          <button
            onClick={() => setCalendarDate(new Date().toISOString())}
            className={`px-3 py-1.5 text-xs font-medium rounded-[var(--radius-md)] transition-colors ml-2 ${
              isToday(currentDate)
                ? 'bg-[var(--surface)] border border-[var(--sep)] text-[var(--label-3)] cursor-default'
                : 'bg-[var(--mod-calendar)] text-white hover:bg-[var(--mod-calendar-h)] cursor-pointer'
            }`}
          >
            {t('calendar.today')}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Board visibility filter */}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setBoardFilterOpen((o) => !o)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[var(--radius-md)] border transition-colors cursor-pointer ${
                boardFilterOpen
                  ? 'bg-[var(--mod-calendar-f)] border-[var(--mod-calendar)] text-[var(--mod-calendar-h)]'
                  : 'bg-transparent border-[var(--sep)] text-[var(--label-2)] hover:bg-[var(--surface-2)]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              {filterLabel}
            </button>

            {boardFilterOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-[var(--surface)] border border-[var(--sep)] rounded-[var(--radius-xl)] shadow-[0_8px_24px_rgba(0,0,0,0.10)] z-50 py-1.5 overflow-hidden">
                <p className="px-3 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--label-3)]">
                  {t('calendar.visibleOnCalendar')}
                </p>
                {boards.length === 0 && (
                  <p className="px-3 py-2 text-xs text-[var(--label-3)]">{t('calendar.noBoardsYet')}</p>
                )}
                {boards.map((board) => {
                  const visible = calendarVisibleBoardIds.includes(board.id)
                  return (
                    <button
                      key={board.id}
                      onClick={() => toggleBoardVisibility(board.id)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--label)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: board.color ?? '#6b7280' }} />
                      <span className="flex-1 text-left truncate">{board.name}</span>
                      <Checkbox checked={visible} />
                    </button>
                  )
                })}
                <div className="border-t border-[var(--sep)] mt-1 pt-1">
                  <button
                    onClick={() => setCalendarVisibleBoards(boards.map((b) => b.id))}
                    className="w-full px-3 py-1.5 text-xs text-left text-[var(--mod-calendar-h)] hover:bg-[var(--mod-calendar-f)] transition-colors cursor-pointer"
                  >
                    {t('calendar.showAll')}
                  </button>
                  <button
                    onClick={() => setCalendarVisibleBoards([])}
                    className="w-full px-3 py-1.5 text-xs text-left text-[var(--label-3)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                  >
                    {t('calendar.hideAll')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* View switcher */}
          <div className="flex bg-[var(--surface-3)] rounded-[var(--radius-md)] p-0.5">
            {views.map((v) => (
              <button
                key={v.id}
                onClick={() => setCalendarView(v.id)}
                className={`px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-colors cursor-pointer ${
                  calendarView === v.id
                    ? 'bg-[var(--surface)] text-[var(--label)] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                    : 'text-[var(--label-3)] hover:text-[var(--label-2)]'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="px-6 py-2 text-xs text-[var(--label-3)] bg-[var(--surface-2)] border-b border-[var(--sep)]">
          {t('calendar.loadingTasks')}
        </div>
      )}

      <div className="flex-1 overflow-auto p-6">
      <AnimatePresence mode="wait">
      <motion.div
        key={calendarView}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.35, ease: [0.77, 0, 0.175, 1] }}
      >
        {calendarView === 'monthly' && (
          <div className="rounded-[var(--radius-xl)] overflow-hidden border border-[var(--sep)]">
            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 border-b border-[var(--sep)] bg-[var(--surface-2)]">
              {DAY_KEYS.map((k) => (
                <div key={k} className="text-center text-[10px] font-semibold text-[var(--label-3)] uppercase py-2 tracking-wider">
                  {t(`calendar.days.${k}`)}
                </div>
              ))}
            </div>

            {/* Week rows */}
            {weeks.map((week, weekIdx) => {
              const bars = getWeekBars(week, tasks, calendarVisibleBoardIds)
              const maxSlot = bars.length > 0 ? Math.max(...bars.map(b => b.slot)) : -1
              const eventsHeight = Math.max((maxSlot + 1) * 22 + 4, 88)

              return (
                <div key={weekIdx} className={`relative ${weekIdx < weeks.length - 1 ? 'border-b border-[var(--sep)]' : ''}`}>
                  {/* Day number row — display only, no interaction */}
                  <div className="grid grid-cols-7 divide-x divide-[var(--sep)]">
                    {week.map((day) => (
                      <div
                        key={day.toISOString()}
                        className={`py-1.5 px-2 bg-[var(--surface)] flex items-center ${!isSameMonth(day, currentDate) ? 'opacity-30' : ''}`}
                      >
                        <span className={`relative text-sm font-medium inline-flex items-center justify-center w-6 h-6 ${isToday(day) ? 'bg-[var(--mod-calendar)] text-white rounded-full' : 'text-[var(--label)]'}`} style={{ zIndex: 30 }}>
                          {format(day, 'd')}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Events area */}
                  <div className="relative" style={{ height: eventsHeight }}>
                    {/* Static day backgrounds */}
                    <div className="absolute inset-0 grid grid-cols-7 divide-x divide-[var(--sep)]">
                      {week.map((day) => (
                        <div
                          key={day.toISOString()}
                          className={`bg-[var(--surface)] ${!isSameMonth(day, currentDate) ? 'opacity-30' : ''}`}
                        />
                      ))}
                    </div>

                    {/* Spanning task bars — above overlay (z-20) */}
                    {bars.map((bar) => {
                      const color = getBoardColor(bar.task.boardId)
                      const radius = bar.isStart && bar.isEnd ? '4px'
                        : bar.isStart ? '4px 0 0 4px'
                        : bar.isEnd ? '0 4px 4px 0'
                        : '0'
                      return (
                        <div
                          key={bar.task.id}
                          onClick={(e) => handleTaskClick(e, bar.task.id)}
                          title={`${getBoardName(bar.task.boardId)} · ${bar.task.title}`}
                          className="absolute flex items-center text-[10px] font-medium px-1.5 truncate cursor-pointer hover:opacity-75 transition-opacity"
                          style={{
                            left: `calc(${(bar.startIdx / 7) * 100}% + 2px)`,
                            width: `calc(${((bar.endIdx - bar.startIdx + 1) / 7) * 100}% - 4px)`,
                            top: bar.slot * 22 + 2,
                            height: 20,
                            borderRadius: radius,
                            backgroundColor: `${color}22`,
                            color,
                            zIndex: 20,
                          }}
                        >
                          {bar.isStart && (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full shrink-0 mr-1" style={{ backgroundColor: color }} />
                              <span className="truncate">{bar.task.title}</span>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Single click+hover overlay per day column, spanning full row height (header + events) */}
                  <div className="absolute inset-0 grid grid-cols-7 pointer-events-none">
                    {week.map((day) => (
                      <div
                        key={`overlay-${day.toISOString()}`}
                        onClick={() => handleDayClick(day)}
                        className="pointer-events-auto cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
                        style={{ zIndex: 10 }}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {calendarView === 'weekly' && (() => {
          const weekBars = getWeekBars(weekDays, tasks, calendarVisibleBoardIds)
          const maxSlot = weekBars.length > 0 ? Math.max(...weekBars.map(b => b.slot)) : -1
          const eventsHeight = Math.max((maxSlot + 1) * 28 + 4, 300)
          return (
          <div className="rounded-[var(--radius-xl)] overflow-hidden border border-[var(--sep)]">
            {/* Day headers */}
            <div className="grid grid-cols-7 divide-x divide-[var(--sep)] border-b border-[var(--sep)] bg-[var(--surface-2)]">
              {weekDays.map((day) => (
                <div
                  key={day.toISOString()}
                  className={`py-3 text-center ${isToday(day) ? 'text-[var(--mod-calendar-h)]' : 'text-[var(--label-2)]'}`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider">{t(`calendar.days.${DAY_KEYS[getDay(day)]}`)}</p>
                  <p className={`text-lg font-bold mt-1 inline-flex items-center justify-center w-8 h-8 ${isToday(day) ? 'bg-[var(--mod-calendar)] text-white rounded-full' : ''}`}>
                    {format(day, 'd')}
                  </p>
                </div>
              ))}
            </div>

            {/* Events area */}
            <div className="relative" style={{ height: eventsHeight }}>
              {/* Static day backgrounds */}
              <div className="absolute inset-0 grid grid-cols-7 divide-x divide-[var(--sep)]">
                {weekDays.map((day) => (
                  <div key={day.toISOString()} className="bg-[var(--surface)]" />
                ))}
              </div>

              {/* Spanning task bars */}
              {weekBars.map((bar) => {
                const color = getBoardColor(bar.task.boardId)
                const radius = bar.isStart && bar.isEnd ? '6px'
                  : bar.isStart ? '6px 0 0 6px'
                  : bar.isEnd ? '0 6px 6px 0'
                  : '0'
                return (
                  <div
                    key={bar.task.id}
                    onClick={(e) => handleTaskClick(e, bar.task.id)}
                    title={`${getBoardName(bar.task.boardId)} · ${bar.task.title}`}
                    className="absolute flex items-center text-xs font-medium px-2 truncate cursor-pointer hover:opacity-75 transition-opacity"
                    style={{
                      left: `calc(${(bar.startIdx / 7) * 100}% + 3px)`,
                      width: `calc(${((bar.endIdx - bar.startIdx + 1) / 7) * 100}% - 6px)`,
                      top: bar.slot * 28 + 4,
                      height: 24,
                      borderRadius: radius,
                      backgroundColor: `${color}22`,
                      color,
                      zIndex: 20,
                    }}
                  >
                    {bar.isStart && (
                      <>
                        <span className="w-2 h-2 rounded-full shrink-0 mr-1.5" style={{ backgroundColor: color }} />
                        <span className="truncate">{bar.task.title}</span>
                      </>
                    )}
                  </div>
                )
              })}

              {/* Full-column click overlays */}
              <div className="absolute inset-0 grid grid-cols-7 pointer-events-none">
                {weekDays.map((day) => (
                  <div
                    key={`overlay-${day.toISOString()}`}
                    onClick={() => handleDayClick(day)}
                    className="pointer-events-auto cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
                    style={{ zIndex: 10 }}
                  />
                ))}
              </div>
            </div>
          </div>
          )
        })()}

        {calendarView === 'daily' && (
          <div className="max-w-2xl mx-auto">
            <div className="flex justify-end mb-4">
              <Button onClick={() => handleDayClick(currentDate)} size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
                {t('calendar.newTask')}
              </Button>
            </div>
            {tasksOnDate(currentDate).length === 0 ? (
              <EmptyState icon={CalendarDays} title={t('calendar.noTasksForDay')} />
            ) : (
              <div className="bg-[var(--surface)] rounded-[var(--radius-xl)] border border-[var(--sep)] divide-y divide-[var(--sep)]">
                {tasksOnDate(currentDate).map((t) => (
                  <div
                    key={t.id}
                    onClick={(e) => handleTaskClick(e, t.id)}
                    className="flex items-center justify-between py-3 px-4 cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getBoardColor(t.boardId) }} title={getBoardName(t.boardId)} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--label)] truncate">{t.title}</p>
                        {t.description && (
                          <p className="text-xs text-[var(--label-3)] mt-0.5 truncate max-w-md">{t.description}</p>
                        )}
                      </div>
                    </div>
                    <PriorityPill priority={t.priority} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>
      </AnimatePresence>
      </div>

      {newTaskState && (
        <TaskModal
          task={null}
          columnId={newTaskState.columnId}
          boardId={newTaskState.boardId}
          showBoardPicker
          onClose={() => setNewTaskState(null)}
          initialDueDate={newTaskState.date}
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
