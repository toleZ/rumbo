import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import type { Locale } from 'date-fns'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { CalendarDays, ExternalLink, Plus } from 'lucide-react'
import { PriorityPill } from '../kanban/PriorityPill'
import { EmptyState } from '../ui/EmptyState'
import { listContainer, listItem, DUR, easeOut } from '../../lib/motionPresets'
import type { Task } from '../../types'
import type { GoogleCalendarEvent } from '../../../../server/src/application/ports/IGoogleCalendarClient'

interface CalendarDayListProps {
  date: Date
  events: GoogleCalendarEvent[]
  tasks: Task[]
  locale: Locale
  googleColor: string
  getBoardColor: (boardId: string) => string
  getBoardName: (boardId: string) => string
  /** -1 when the newly picked day is earlier than the previous one, 1 when later, 0 on first paint. */
  direction: number
  onEventClick: (ev: GoogleCalendarEvent) => void
  onTaskClick: (e: React.MouseEvent, taskId: string) => void
  onAddTask: (date: Date) => void
}

// Matches the page-level view transition's 16px offset, so switching days and
// switching months feel like the same gesture at different scales.
const SLIDE_PX = 16

/**
 * The events and tasks of ONE day, listed in time order.
 *
 * Shared by the compact month and week views: in both, the grid/strip above is
 * only a picker, and this is where the day's content is actually readable. Both
 * views rendering the same component is what makes them read as one system
 * rather than two designs that happen to sit under the same tab bar.
 */
export function CalendarDayList({
  date, events, tasks, locale, googleColor,
  getBoardColor, getBoardName, direction, onEventClick, onTaskClick, onAddTask,
}: CalendarDayListProps) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()

  // All-day events lead (they have no start time to sort against), then timed
  // events in clock order — Google's ordering isn't guaranteed once a multi-day
  // event has been fanned out across the days it spans.
  const sortedEvents = [...events].sort((a, b) => {
    if (a.isAllDay !== b.isAllDay) return a.isAllDay ? -1 : 1
    return new Date(a.start).getTime() - new Date(b.start).getTime()
  })

  const isEmpty = sortedEvents.length === 0 && tasks.length === 0
  // Keyed on the calendar day, not the Date instance: the parent rebuilds that
  // object every render, which would restart the transition on unrelated updates.
  const dayKey = format(date, 'yyyy-MM-dd')

  // The heading and the rows animate together as one unit: the day's title changing
  // is the clearest signal that the selection moved, so splitting them would make the
  // list look like it re-sorted rather than switched days.
  // Under reduced motion the content swaps with no fade and no travel at all —
  // the CSS contract in index.css sets `animation: none; opacity: 1`, and a
  // JS-driven fade would quietly reintroduce exactly what that promises to remove.
  const initial = reducedMotion
    ? { opacity: 1, x: 0 }
    : { opacity: 0, x: direction * SLIDE_PX }
  const enter = reducedMotion
    ? { opacity: 1, x: 0, transition: { duration: 0 } }
    : { opacity: 1, x: 0, transition: { duration: DUR.view, ease: easeOut } }
  const exit = reducedMotion
    ? { opacity: 1, x: 0, transition: { duration: 0 } }
    : { opacity: 0, x: direction * -SLIDE_PX, transition: { duration: DUR.hover, ease: easeOut } }

  return (
    <section className="flex flex-col min-h-0">
      {/* The add button sits outside the animated block: it belongs to the day
          *picker*, not to the day's contents, and re-sliding it on every tap
          would read as the control moving rather than the content changing. */}
      <div className="flex items-center gap-2 px-1 pb-2">
        <AnimatePresence mode="wait" initial={false}>
          <motion.h3
            key={dayKey}
            initial={initial}
            animate={enter}
            exit={exit}
            className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--label)]"
          >
            {format(date, 'EEEE d', { locale })}
          </motion.h3>
        </AnimatePresence>
        <button
          onClick={() => onAddTask(date)}
          aria-label={t('calendar.newTask')}
          className="w-9 h-9 flex items-center justify-center shrink-0 rounded-[var(--radius-md)] text-[var(--label-3)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={dayKey} initial={initial} animate={enter} exit={exit}>
          {isEmpty ? (
            <EmptyState icon={CalendarDays} title={t('calendar.dayEmpty')} />
          ) : (
            // Rows cascade in behind the slide — the same 40ms-interval stagger
            // the app uses for card/list entrances elsewhere.
            <motion.div
              variants={reducedMotion ? undefined : listContainer}
              initial="initial"
              animate="animate"
              className="bg-[var(--surface)] rounded-[var(--radius-xl)] border border-[var(--sep)] divide-y divide-[var(--sep)] overflow-hidden"
            >
              {sortedEvents.map((ev) => (
                <motion.button
                  key={ev.id}
                  variants={reducedMotion ? undefined : listItem}
                  onClick={() => onEventClick(ev)}
                  className="w-full flex items-center gap-3 py-3 px-3 text-left hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                >
                  <span className="w-14 shrink-0 text-[11px] leading-tight text-[var(--label-3)]">
                    {ev.isAllDay ? t('calendar.allDay') : format(new Date(ev.start), 'p', { locale })}
                  </span>
                  <span className="w-2 h-2 rounded-[var(--radius-full)] shrink-0" style={{ backgroundColor: googleColor }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-[var(--label)] truncate">{ev.title}</span>
                    {ev.location && (
                      <span className="block text-xs text-[var(--label-3)] mt-0.5 truncate">{ev.location}</span>
                    )}
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-[var(--label-3)] shrink-0" />
                </motion.button>
              ))}

              {tasks.map((task) => (
                // A real button, not a clickable div: these rows open the task panel,
                // so they need to be keyboard-reachable and announced as controls
                // exactly like the event rows above them.
                <motion.button
                  key={task.id}
                  variants={reducedMotion ? undefined : listItem}
                  onClick={(e) => onTaskClick(e, task.id)}
                  className="w-full flex items-center gap-3 py-3 px-3 text-left hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                >
                  {/* Empty time slot rather than a collapsed one: tasks carry a date but
                      no time, and dropping the column would misalign them against the
                      events above — that alignment is the scanning cue this layout
                      depends on. */}
                  <span className="w-14 shrink-0" />
                  <span
                    className="w-2 h-2 rounded-[var(--radius-full)] shrink-0"
                    style={{ backgroundColor: getBoardColor(task.boardId) }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-[var(--label)] truncate">{task.title}</span>
                    <span className="block text-xs text-[var(--label-3)] mt-0.5 truncate">{getBoardName(task.boardId)}</span>
                  </span>
                  <PriorityPill priority={task.priority} />
                </motion.button>
              ))}
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  )
}
