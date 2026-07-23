import { useTranslation } from 'react-i18next'
import {
  format, getDay,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays,
  isSameMonth, isSameDay, isToday, isBefore, isAfter,
  startOfDay, endOfDay, differenceInCalendarDays,
} from 'date-fns'
import { getDateLocale } from '../../lib/dateLocale'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronLeft, ChevronRight, Plus, Layers, CalendarDays, RefreshCw } from 'lucide-react'
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
import { trpc } from '../../lib/trpc'
import { useAuthStore } from '../../stores/authStore'
import { ExternalLink, MapPin } from 'lucide-react'
import type { GoogleCalendarEvent } from '../../../../server/src/application/ports/IGoogleCalendarClient'

const GOOGLE_COLOR = '#4285F4'
const GOOGLE_AUTHORIZE_URL = import.meta.env.VITE_API_GOOGLE_AUTHORIZE_URL ?? '/api/connections/google/authorize'

// Buckets an ISO instant into a calendar day key (YYYY-MM-DD) using the account's stored
// timezone (falling back to the browser's) — not the browser's alone — so the day an
// event lands on is consistent regardless of which device/timezone Rumbo is being viewed
// from. All-day dates are already a bare YYYY-MM-DD, no conversion needed.
function eventDayKey(iso: string, timezone: string | null): string {
  if (iso.length === 10) return iso
  const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
}

// Local midnight for a YYYY-MM-DD key, matching how `week`'s own Date objects (and
// Task.scheduledDate/dueDate, which are also treated as bare dates elsewhere in this
// file) are represented — so range comparisons against `week` days work correctly.
function dayKeyToDate(key: string): Date {
  return new Date(`${key}T00:00:00`)
}

function dateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

// Returns true if a task is active on a given date (range-aware)
function isTaskOnDate(task: Task, date: Date): boolean {
  const s = task.scheduledDate ? startOfDay(new Date(task.scheduledDate)) : null
  const d = task.dueDate ? endOfDay(new Date(task.dueDate)) : null
  if (s && d) return !isBefore(date, s) && !isAfter(date, d)
  if (s) return isSameDay(s, date)
  if (d) return isSameDay(d, date)
  return false
}

interface RangeBar<T> {
  item: T
  startIdx: number  // 0–6 within the week
  endIdx: number    // 0–6 within the week
  isStart: boolean  // actual range start falls within this week
  isEnd: boolean    // actual range end falls within this week
  slot: number      // vertical row (for stacking)
}

// Generic multi-day spanning-bar layout: given a week and a way to read each item's
// [start, end] range, clips each to the visible week and assigns non-overlapping vertical
// slots (first-fit, longest-span-first) — shared by Task bars and Google event bars so
// both get identical multi-day spanning behavior instead of two hand-rolled copies.
function computeBars<T>(week: Date[], items: T[], getRange: (item: T) => { start: Date; end: Date }): RangeBar<T>[] {
  const weekStart = startOfDay(week[0])
  const weekEnd = endOfDay(week[6])

  const ranged = items
    .map((item) => ({ item, range: getRange(item) }))
    .filter(({ range }) => !isAfter(range.start, weekEnd) && !isBefore(range.end, weekStart))

  // Longer spans first, then earlier start
  ranged.sort((a, b) => {
    const aDur = differenceInCalendarDays(a.range.end, a.range.start)
    const bDur = differenceInCalendarDays(b.range.end, b.range.start)
    if (bDur !== aDur) return bDur - aDur
    return a.range.start.getTime() - b.range.start.getTime()
  })

  const slotOccupancy: { start: number; end: number }[][] = []

  return ranged.map(({ item, range }) => {
    const visStart = isBefore(range.start, weekStart) ? weekStart : range.start
    const visEnd = isAfter(range.end, weekEnd) ? weekEnd : range.end

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
      item,
      startIdx,
      endIdx,
      isStart: !isBefore(range.start, weekStart),
      isEnd: !isAfter(range.end, weekEnd),
      slot,
    }
  })
}

function getWeekBars(week: Date[], tasks: Task[], visibleBoardIds: string[]): RangeBar<Task>[] {
  const weekTasks = tasks.filter((task) => visibleBoardIds.includes(task.boardId) && (task.scheduledDate || task.dueDate))
  return computeBars(week, weekTasks, (task) => {
    const start = task.scheduledDate ? startOfDay(new Date(task.scheduledDate)) : startOfDay(new Date(task.dueDate!))
    const end = task.dueDate ? endOfDay(new Date(task.dueDate)) : endOfDay(start)
    return { start, end }
  })
}

// Same spanning-bar treatment as tasks — a Google event with both a start and end day
// now renders across its full range instead of being pinned to its start day only. Day
// boundaries are resolved via eventDayKey (the account's timezone), not a raw
// startOfDay(new Date(iso)) in the browser's local zone, for the same reason the
// day-indicator dots need it: a late-evening timed event must land on the correct day
// regardless of which timezone the browser happens to be in.
function getWeekEventBars(week: Date[], events: GoogleCalendarEvent[], timezone: string | null): RangeBar<GoogleCalendarEvent>[] {
  return computeBars(week, events, (ev) => {
    const start = dayKeyToDate(eventDayKey(ev.start, timezone))
    const end = endOfDay(dayKeyToDate(eventDayKey(ev.end, timezone)))
    return { start, end }
  })
}

export function CalendarPage() {
  const { t, i18n } = useTranslation()
  const locale = getDateLocale(i18n.language)
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
  // Custom hover card for Google event bars (title/location/description), styled to match
  // the app rather than the browser's native `title` tooltip — position is computed from
  // the hovered bar's own bounding rect, same JS-positioned-popover pattern as HabitsPage's
  // measurable-value popup, since there's no portal/Tooltip primitive in this codebase.
  const [hoveredEvent, setHoveredEvent] = useState<{ ev: GoogleCalendarEvent; x: number; y: number } | null>(null)
  const showEventTooltip = (e: React.MouseEvent<HTMLElement>, ev: GoogleCalendarEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setHoveredEvent({ ev, x: rect.left + rect.width / 2, y: rect.top })
  }
  const hideEventTooltip = () => setHoveredEvent(null)
  // Last navigation direction (1 = forward, -1 = back) — the grid slides in
  // from the side being navigated toward.
  const [navDir, setNavDir] = useState(0)
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
    setNavDir(dir)
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

  // --- Google Calendar read overlay ---
  const user = useAuthStore((s) => s.user)
  const connectionsQuery = trpc.connections.list.useQuery()
  const isGoogleConnected = Boolean(connectionsQuery.data?.find((c) => c.provider === 'google_calendar')?.connected)
  const rangeStart = calendarView === 'monthly' ? calendarStart : calendarView === 'weekly' ? weekStart : startOfDay(currentDate)
  const rangeEnd = calendarView === 'monthly' ? calendarEnd : calendarView === 'weekly' ? addDays(weekStart, 6) : endOfDay(currentDate)
  const googleEventsQuery = trpc.connections.googleCalendarEvents.useQuery(
    { from: rangeStart.toISOString(), to: rangeEnd.toISOString() },
    { enabled: isGoogleConnected },
  )
  // No polling — refreshed manually (header button) or automatically right after a
  // task push (TaskPanel invalidates this query on a successful push).
  const isGoogleAuthError = (googleEventsQuery.error as { data?: { code?: string } | null } | null)?.data?.code === 'UNAUTHORIZED'
  // A task pushed to Google Calendar shows up on the very next fetch as its own Google
  // event — without this filter it would render twice (once as the task's own bar, once
  // as a "read-only" Google event bar mirroring it). Excluding any event id already
  // linked to one of the user's tasks keeps each pushed task showing exactly once.
  const linkedGoogleEventIds = new Set(tasks.map((t) => t.googleCalendarEventId).filter((id): id is string => Boolean(id)))
  const googleEvents = (googleEventsQuery.data ?? []).filter((ev) => !linkedGoogleEventIds.has(ev.id))
  // Grouped by every day the event spans (not just its start day), so a multi-day
  // event shows up on each day of the daily view, matching the month/week bar overlay.
  const googleEventsByDay = new Map<string, GoogleCalendarEvent[]>()
  for (const ev of googleEvents) {
    const startDate = dayKeyToDate(eventDayKey(ev.start, user?.timezone ?? null))
    const endDate = dayKeyToDate(eventDayKey(ev.end, user?.timezone ?? null))
    for (const day of eachDayOfInterval({ start: startDate, end: endDate })) {
      const key = dateKey(day)
      const list = googleEventsByDay.get(key) ?? []
      list.push(ev)
      googleEventsByDay.set(key, list)
    }
  }
  const openGoogleEvent = (ev: GoogleCalendarEvent) => window.open(ev.htmlLink, '_blank', 'noopener,noreferrer')

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

          {/* Manual refresh of the Google Calendar overlay — no background polling */}
          {isGoogleConnected && (
            <button
              onClick={() => googleEventsQuery.refetch()}
              disabled={googleEventsQuery.isFetching}
              title={t('calendar.refreshGoogle')}
              aria-label={t('calendar.refreshGoogle')}
              className="p-1.5 rounded-[var(--radius-md)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default"
            >
              <RefreshCw className={`w-4 h-4 text-[var(--label-2)] ${googleEventsQuery.isFetching ? 'animate-spin' : ''}`} />
            </button>
          )}

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

      {isGoogleAuthError && (
        <div className="flex items-center justify-between gap-3 px-6 py-2 text-xs bg-[var(--surface-2)] border-b border-[var(--sep)]">
          <span className="text-[var(--label-2)]">{t('calendar.googleReconnectDesc')}</span>
          <button
            onClick={() => { window.location.href = GOOGLE_AUTHORIZE_URL }}
            className="px-3 py-1 rounded-full text-xs font-semibold text-white transition-transform duration-[140ms] active:scale-95 shrink-0"
            style={{ background: GOOGLE_COLOR }}
          >
            {t('calendar.googleReconnect')}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-auto p-6">
      <AnimatePresence mode="wait">
      <motion.div
        key={`${calendarView}-${calendarDate}`}
        initial={{ opacity: 0, x: navDir * 16, scale: navDir === 0 ? 0.98 : 1 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: navDir * -16, scale: navDir === 0 ? 0.98 : 1 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
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
              const eventBars = getWeekEventBars(week, googleEvents, user?.timezone ?? null)
              const taskMaxSlot = bars.length > 0 ? Math.max(...bars.map(b => b.slot)) : -1
              const eventMaxSlot = eventBars.length > 0 ? Math.max(...eventBars.map(b => b.slot)) : -1
              const eventBarsHeight = (eventMaxSlot + 1) * 22
              const taskBarsHeight = (taskMaxSlot + 1) * 22
              const eventsHeight = Math.max(eventBarsHeight + taskBarsHeight + 4, 88)

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

                    {/* Spanning Google event bars — same treatment as task bars below, stacked
                        above them so external (read-only) events read as a distinct group */}
                    {eventBars.map((bar) => {
                      const radius = bar.isStart && bar.isEnd ? '4px'
                        : bar.isStart ? '4px 0 0 4px'
                        : bar.isEnd ? '0 4px 4px 0'
                        : '0'
                      return (
                        <div
                          key={bar.item.id}
                          onClick={(e) => { e.stopPropagation(); openGoogleEvent(bar.item) }}
                          onMouseEnter={(e) => showEventTooltip(e, bar.item)}
                          onMouseLeave={hideEventTooltip}
                          className="absolute flex items-center text-[10px] font-medium px-1.5 truncate cursor-pointer hover:opacity-75 transition-opacity"
                          style={{
                            left: `calc(${(bar.startIdx / 7) * 100}% + 2px)`,
                            width: `calc(${((bar.endIdx - bar.startIdx + 1) / 7) * 100}% - 4px)`,
                            top: bar.slot * 22 + 2,
                            height: 20,
                            borderRadius: radius,
                            backgroundColor: `${GOOGLE_COLOR}22`,
                            color: GOOGLE_COLOR,
                            zIndex: 20,
                          }}
                        >
                          {bar.isStart && (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full shrink-0 mr-1" style={{ backgroundColor: GOOGLE_COLOR }} />
                              <span className="truncate flex-1">{bar.item.title}</span>
                              <ExternalLink className="w-2.5 h-2.5 shrink-0 ml-1" />
                            </>
                          )}
                        </div>
                      )
                    })}

                    {/* Spanning task bars — above overlay (z-20) */}
                    {bars.map((bar) => {
                      const color = getBoardColor(bar.item.boardId)
                      const radius = bar.isStart && bar.isEnd ? '4px'
                        : bar.isStart ? '4px 0 0 4px'
                        : bar.isEnd ? '0 4px 4px 0'
                        : '0'
                      return (
                        <div
                          key={bar.item.id}
                          onClick={(e) => handleTaskClick(e, bar.item.id)}
                          title={`${getBoardName(bar.item.boardId)} · ${bar.item.title}`}
                          className="absolute flex items-center text-[10px] font-medium px-1.5 truncate cursor-pointer hover:opacity-75 transition-opacity"
                          style={{
                            left: `calc(${(bar.startIdx / 7) * 100}% + 2px)`,
                            width: `calc(${((bar.endIdx - bar.startIdx + 1) / 7) * 100}% - 4px)`,
                            top: eventBarsHeight + bar.slot * 22 + 2,
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
                              <span className="truncate">{bar.item.title}</span>
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
          const weekEventBars = getWeekEventBars(weekDays, googleEvents, user?.timezone ?? null)
          const taskMaxSlot = weekBars.length > 0 ? Math.max(...weekBars.map(b => b.slot)) : -1
          const eventMaxSlot = weekEventBars.length > 0 ? Math.max(...weekEventBars.map(b => b.slot)) : -1
          const eventBarsHeight = (eventMaxSlot + 1) * 28
          const taskBarsHeight = (taskMaxSlot + 1) * 28
          const eventsHeight = Math.max(eventBarsHeight + taskBarsHeight + 4, 300)
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

              {/* Spanning Google event bars — same treatment as task bars below, stacked
                  above them so external (read-only) events read as a distinct group */}
              {weekEventBars.map((bar) => {
                const radius = bar.isStart && bar.isEnd ? '6px'
                  : bar.isStart ? '6px 0 0 6px'
                  : bar.isEnd ? '0 6px 6px 0'
                  : '0'
                return (
                  <div
                    key={bar.item.id}
                    onClick={(e) => { e.stopPropagation(); openGoogleEvent(bar.item) }}
                    onMouseEnter={(e) => showEventTooltip(e, bar.item)}
                    onMouseLeave={hideEventTooltip}
                    className="absolute flex items-center text-xs font-medium px-2 truncate cursor-pointer hover:opacity-75 transition-opacity"
                    style={{
                      left: `calc(${(bar.startIdx / 7) * 100}% + 3px)`,
                      width: `calc(${((bar.endIdx - bar.startIdx + 1) / 7) * 100}% - 6px)`,
                      top: bar.slot * 28 + 4,
                      height: 24,
                      borderRadius: radius,
                      backgroundColor: `${GOOGLE_COLOR}22`,
                      color: GOOGLE_COLOR,
                      zIndex: 20,
                    }}
                  >
                    {bar.isStart && (
                      <>
                        <span className="w-2 h-2 rounded-full shrink-0 mr-1.5" style={{ backgroundColor: GOOGLE_COLOR }} />
                        <span className="truncate flex-1">{bar.item.title}</span>
                        <ExternalLink className="w-3 h-3 shrink-0 ml-1" />
                      </>
                    )}
                  </div>
                )
              })}

              {/* Spanning task bars */}
              {weekBars.map((bar) => {
                const color = getBoardColor(bar.item.boardId)
                const radius = bar.isStart && bar.isEnd ? '6px'
                  : bar.isStart ? '6px 0 0 6px'
                  : bar.isEnd ? '0 6px 6px 0'
                  : '0'
                return (
                  <div
                    key={bar.item.id}
                    onClick={(e) => handleTaskClick(e, bar.item.id)}
                    title={`${getBoardName(bar.item.boardId)} · ${bar.item.title}`}
                    className="absolute flex items-center text-xs font-medium px-2 truncate cursor-pointer hover:opacity-75 transition-opacity"
                    style={{
                      left: `calc(${(bar.startIdx / 7) * 100}% + 3px)`,
                      width: `calc(${((bar.endIdx - bar.startIdx + 1) / 7) * 100}% - 6px)`,
                      top: eventBarsHeight + bar.slot * 28 + 4,
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
                        <span className="truncate">{bar.item.title}</span>
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
            {isGoogleConnected && (googleEventsByDay.get(dateKey(currentDate))?.length ?? 0) > 0 && (
              <div className="mb-4 bg-[var(--surface)] rounded-[var(--radius-xl)] border border-[var(--sep)] divide-y divide-[var(--sep)]">
                {googleEventsByDay.get(dateKey(currentDate))!.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => openGoogleEvent(ev)}
                    className="w-full flex items-center justify-between gap-3 py-3 px-4 text-left hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: GOOGLE_COLOR }} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--label)] truncate">{ev.title}</p>
                        <p className="text-xs text-[var(--label-3)] mt-0.5">
                          {ev.isAllDay ? t('calendar.allDay') : `${format(new Date(ev.start), 'p', { locale })} – ${format(new Date(ev.end), 'p', { locale })}`}
                        </p>
                        {ev.location && (
                          <p className="text-xs text-[var(--label-3)] mt-0.5 truncate">{ev.location}</p>
                        )}
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-[var(--label-3)] shrink-0" />
                  </button>
                ))}
              </div>
            )}
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

      {/* Google event hover card — rendered outside the animated view so `position: fixed`
          stays relative to the viewport (an ancestor with a transform, like motion.div's
          slide animation, would otherwise become its containing block and clip it).
          Keyed by event id so AnimatePresence plays a fresh pop-in/out per hovered event
          (rather than one persistent node snapping between positions), and the entrance's
          `y` is expressed as a percentage of the card's own height (-97% → -100%) so it
          composes with the fixed "anchor above the bar" offset instead of fighting it. */}
      <AnimatePresence>
        {hoveredEvent && (
          <motion.div
            key={hoveredEvent.ev.id}
            initial={{ opacity: 0, scale: 0.92, x: '-50%', y: '-97%' }}
            animate={{ opacity: 1, scale: 1, x: '-50%', y: '-100%' }}
            exit={{ opacity: 0, scale: 0.92, x: '-50%', y: '-97%' }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.14, ease: [0.23, 1, 0.32, 1] }}
            className="fixed z-50 pointer-events-none origin-bottom w-64 bg-[var(--surface)] border border-[var(--sep)] rounded-[var(--radius-lg)] shadow-[0_4px_16px_rgba(0,0,0,0.08)] px-3 py-2.5"
            style={{ left: hoveredEvent.x, top: hoveredEvent.y - 8 }}
          >
            <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--label)]">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: GOOGLE_COLOR }} />
              <span className="truncate">{hoveredEvent.ev.title}</span>
            </p>
            <p className="text-[11px] text-[var(--label-3)] mt-1">
              {hoveredEvent.ev.isAllDay
                ? t('calendar.allDay')
                : `${format(new Date(hoveredEvent.ev.start), 'p', { locale })} – ${format(new Date(hoveredEvent.ev.end), 'p', { locale })}`}
            </p>
            {hoveredEvent.ev.location && (
              <p className="flex items-start gap-1 text-[11px] text-[var(--label-2)] mt-1.5">
                <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                <span className="truncate">{hoveredEvent.ev.location}</span>
              </p>
            )}
            {hoveredEvent.ev.description && (
              <p className="text-[11px] text-[var(--label-2)] mt-1.5 line-clamp-3">{hoveredEvent.ev.description}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

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
