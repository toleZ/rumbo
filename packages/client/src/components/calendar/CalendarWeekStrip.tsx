import { format, isSameDay, isToday } from 'date-fns'
import type { Locale } from 'date-fns'
import { motion, useReducedMotion } from 'motion/react'
import { springSnappy } from '../../lib/motionPresets'
import type { CompactDay } from './CalendarCompactMonth'

interface CalendarWeekStripProps {
  days: CompactDay[]
  selectedDate: Date
  locale: Locale
  onSelect: (date: Date) => void
}

const MAX_DOTS = 3

// Deliberately not shared with the month grid's pill id — see the note there.
const PILL_LAYOUT_ID = 'calendar-week-day-pill'

/**
 * The seven days of the current week as a single selectable row, with the same
 * dot-density language as the compact month grid.
 *
 * Deliberately not an hour-by-hour timeline: tasks in Rumbo carry a date but no
 * time, so most of what this view has to show could not be placed on an hour
 * axis at all and would pile up in an all-day gutter above an empty grid.
 */
export function CalendarWeekStrip({ days, selectedDate, locale, onSelect }: CalendarWeekStripProps) {
  const reducedMotion = useReducedMotion()

  return (
    <div className="grid grid-cols-7 gap-px select-none">
      {days.map((day) => {
        const selected = isSameDay(day.date, selectedDate)
        const today = isToday(day.date)

        return (
          <button
            key={day.date.toISOString()}
            onClick={() => onSelect(day.date)}
            aria-pressed={selected}
            aria-label={format(day.date, 'PPPP', { locale })}
            className={`relative flex flex-col items-center gap-1 py-2 rounded-[var(--radius-md)] transition-[background-color,transform] duration-[160ms] active:scale-[0.97] cursor-pointer ${
              selected ? '' : 'hover:bg-[var(--surface-2)]'
            }`}
          >
            {/* Shared-layout pill — slides along the strip between days rather
                than cross-fading, matching the compact month grid. */}
            {selected && (
              <motion.span
                layoutId={PILL_LAYOUT_ID}
                transition={reducedMotion ? { duration: 0 } : springSnappy}
                className="absolute inset-0 rounded-[var(--radius-md)] bg-[var(--mod-calendar-f)]"
                aria-hidden="true"
              />
            )}

            <span className="relative z-10 text-[11px] font-semibold uppercase tracking-wider text-[var(--label-3)]">
              {format(day.date, 'EEEEE', { locale })}
            </span>
            <span
              className={`relative z-10 flex items-center justify-center w-8 h-8 text-sm rounded-[var(--radius-full)] ${
                today
                  ? 'bg-[var(--mod-calendar)] text-white font-semibold'
                  : selected
                    ? 'text-[var(--mod-calendar-h)] font-semibold'
                    : 'text-[var(--label)]'
              }`}
            >
              {format(day.date, 'd')}
            </span>
            <span className="relative z-10 flex items-center justify-center gap-0.5 h-1.5">
              {day.dots.slice(0, MAX_DOTS).map((dot) => (
                <span
                  key={dot.key}
                  className="w-1.5 h-1.5 rounded-[var(--radius-full)]"
                  style={{ backgroundColor: dot.color }}
                />
              ))}
            </span>
          </button>
        )
      })}
    </div>
  )
}
