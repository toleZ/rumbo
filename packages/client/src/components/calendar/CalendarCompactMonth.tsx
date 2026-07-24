import { format, isSameDay, isSameMonth, isToday } from 'date-fns'
import type { Locale } from 'date-fns'
import { motion, useReducedMotion } from 'motion/react'
import { springSnappy } from '../../lib/motionPresets'

export interface CompactDayDot {
  key: string
  color: string
}

export interface CompactDay {
  date: Date
  dots: CompactDayDot[]
}

interface CalendarCompactMonthProps {
  weeks: CompactDay[][]
  monthDate: Date
  selectedDate: Date
  dayLabels: string[]
  locale: Locale
  onSelect: (date: Date) => void
}

// Apple caps the dot row rather than letting a busy day turn into a stack of
// dots; past that the count stops being scannable and the cell just looks noisy.
const MAX_DOTS = 3

// Distinct from the week strip's id: the two views never coexist, but they do
// swap places inside a keyed AnimatePresence, and a shared id would make the
// pill try to fly between two different layouts mid-unmount.
const PILL_LAYOUT_ID = 'calendar-month-day-pill'

/**
 * Month grid for phones and tablets — a picker, not a content surface.
 *
 * The desktop grid puts titled bars inside each cell, which needs ~120px of
 * width per column; below `lg` a column is 45-90px, so the bars became unreadable
 * slivers. This follows the platform convention instead: the grid carries only
 * *density* (a dot per item, capped), and the selected day's actual content is
 * listed underneath by CalendarDayList.
 */
export function CalendarCompactMonth({
  weeks, monthDate, selectedDate, dayLabels, locale, onSelect,
}: CalendarCompactMonthProps) {
  const reducedMotion = useReducedMotion()

  return (
    <div className="select-none">
      <div className="grid grid-cols-7">
        {dayLabels.map((label) => (
          <div
            key={label}
            className="py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-[var(--label-3)]"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px">
        {weeks.flat().map((day) => {
          const inMonth = isSameMonth(day.date, monthDate)
          const selected = isSameDay(day.date, selectedDate)
          const today = isToday(day.date)

          return (
            <button
              key={day.date.toISOString()}
              onClick={() => onSelect(day.date)}
              aria-pressed={selected}
              aria-label={format(day.date, 'PPPP', { locale })}
              className={`relative flex flex-col items-center gap-1 py-1.5 sm:py-2 rounded-[var(--radius-md)] transition-[background-color,transform] duration-[160ms] active:scale-[0.97] cursor-pointer ${
                selected ? '' : 'hover:bg-[var(--surface-2)]'
              }`}
            >
              {/* Shared-layout pill — glides from the previously selected cell
                  instead of blinking out here and in there, so the selection
                  reads as one object moving. Same technique as the sidebar's
                  nav pill. */}
              {selected && (
                <motion.span
                  layoutId={PILL_LAYOUT_ID}
                  transition={reducedMotion ? { duration: 0 } : springSnappy}
                  className="absolute inset-0 rounded-[var(--radius-md)] bg-[var(--mod-calendar-f)]"
                  aria-hidden="true"
                />
              )}

              <span
                className={`relative z-10 flex items-center justify-center w-7 h-7 text-sm rounded-[var(--radius-full)] ${
                  today
                    ? 'bg-[var(--mod-calendar)] text-white font-semibold'
                    : selected
                      ? 'text-[var(--mod-calendar-h)] font-semibold'
                      : inMonth
                        ? 'text-[var(--label)]'
                        : 'text-[var(--label-3)]'
                }`}
              >
                {format(day.date, 'd')}
              </span>

              {/* Fixed-height dot rail so cells keep a common baseline whether or
                  not they have content — without it the grid rows jitter as you
                  page between months. */}
              <span className="relative z-10 flex items-center justify-center gap-0.5 h-1.5">
                {day.dots.slice(0, MAX_DOTS).map((dot) => (
                  <span
                    key={dot.key}
                    className="w-1.5 h-1.5 rounded-[var(--radius-full)]"
                    style={{ backgroundColor: dot.color, opacity: inMonth ? 1 : 0.4 }}
                  />
                ))}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
