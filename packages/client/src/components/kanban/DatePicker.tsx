import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar, Clock } from 'lucide-react'
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns'
import { createPortal } from 'react-dom'

interface DatePickerProps {
  value: string
  onChange: (iso: string) => void
  placeholder?: string
  /** When true, also shows a time-of-day input and combines it into the emitted ISO string. */
  includeTime?: boolean
  /** Hide the "Clear date" affordance — for values that can't be null (e.g. an existing reminder). */
  hideClear?: boolean
}

const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

// Scrollable chip column for the time picker — same visual language as the
// day grid above it (accent chip for the selection, surface hover elsewhere).
function TimeColumn({ label, values, selected, onSelect }: {
  label: string
  values: number[]
  selected: number
  onSelect: (v: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  // Center the selected chip whenever it changes (and on open).
  useEffect(() => {
    const list = ref.current
    const chip = list?.querySelector<HTMLElement>('[data-selected="true"]')
    if (list && chip) {
      list.scrollTop = chip.offsetTop - list.clientHeight / 2 + chip.clientHeight / 2
    }
  }, [selected])

  return (
    <div className="flex-1 min-w-0">
      <div className="text-center text-[10px] font-medium text-[var(--label-3)] py-1">{label}</div>
      {/* relative: makes this the chips' offsetParent so the centering
          scroll math in the effect above is container-local */}
      <div ref={ref} className="relative h-28 overflow-y-auto rounded-[8px] bg-[var(--surface-2)] p-1">
        {values.map((v) => (
          <button
            key={v}
            type="button"
            data-selected={v === selected || undefined}
            onClick={() => onSelect(v)}
            className={`w-full h-7 flex items-center justify-center text-xs rounded-[6px] transition-colors tabular-nums ${
              v === selected
                ? 'bg-[var(--accent)] text-white font-semibold'
                : 'text-[var(--label)] hover:bg-[var(--surface-3)]'
            }`}
          >
            {String(v).padStart(2, '0')}
          </button>
        ))}
      </div>
    </div>
  )
}

export function DatePicker({ value, onChange, placeholder = 'Pick a date', includeTime = false, hideClear = false }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => (value ? new Date(value) : new Date()))
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = value ? new Date(value) : null
  // Local HH:mm state for the time input; kept in sync with `value` (falls back
  // to a sensible default so picking a day before touching the time input
  // still produces a usable timestamp).
  const [time, setTime] = useState(() => (selected ? format(selected, 'HH:mm') : '09:00'))
  useEffect(() => {
    if (includeTime && selected) setTime(format(selected, 'HH:mm'))
  }, [value])

  const combineDayAndTime = (day: Date, timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number)
    const combined = new Date(day)
    combined.setHours(h || 0, m || 0, 0, 0)
    return combined
  }

  const openDropdown = () => {
    if (!open && selected) setMonth(selected)
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      // The dropdown is `position: fixed`, computed once here — it won't move if
      // the page scrolls, so if there isn't room below the trigger (especially
      // with includeTime's extra time-input/Done row making it taller), flip it
      // above instead of letting it render off the bottom of the viewport with
      // no way to reach it.
      const estimatedHeight = includeTime ? 520 : 340
      const top = rect.bottom + estimatedHeight + 6 > window.innerHeight
        ? Math.max(8, rect.top - estimatedHeight - 6)
        : rect.bottom + 6
      setDropdownPos({ top, left: rect.left, width: rect.width })
    }
    setOpen((v) => !v)
  }

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month)),
    end: endOfWeek(endOfMonth(month)),
  })

  const handleSelect = (day: Date) => {
    if (includeTime) {
      // Keep the dropdown open so the user can also adjust the time.
      onChange(combineDayAndTime(day, time).toISOString())
    } else {
      onChange(day.toISOString())
      setOpen(false)
    }
  }

  const handleTimeChange = (newTime: string) => {
    setTime(newTime)
    if (selected) onChange(combineDayAndTime(selected, newTime).toISOString())
  }

  const [timeHour, timeMinute] = time.split(':').map(Number)
  // 5-minute steps; if the current value sits between steps (e.g. an existing
  // 09:37 reminder), include it so the selection is always visible.
  const minuteValues = (() => {
    const steps = Array.from({ length: 12 }, (_, i) => i * 5)
    return steps.includes(timeMinute) ? steps : [...steps, timeMinute].sort((a, b) => a - b)
  })()

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
  }

  const dropdown = open ? (
    <div
      ref={containerRef}
      className="fixed z-[200] bg-[var(--surface)] border border-[var(--sep)] rounded-[12px] shadow-[0_8px_30px_rgba(0,0,0,0.15)] p-3 w-64 animate-modal-in"
      style={{ top: dropdownPos.top, left: dropdownPos.left }}
    >
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setMonth((m) => subMonths(m, 1))}
          className="p-1 rounded-[6px] hover:bg-[var(--surface-2)] transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-[var(--label-2)]" />
        </button>
        <span className="text-sm font-semibold text-[var(--label)]">
          {format(month, 'MMMM yyyy')}
        </span>
        <button
          type="button"
          onClick={() => setMonth((m) => addMonths(m, 1))}
          className="p-1 rounded-[6px] hover:bg-[var(--surface-2)] transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-[var(--label-2)]" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_HEADERS.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-[var(--label-3)] py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((day) => {
          const isSelected = selected ? isSameDay(day, selected) : false
          const isCurrentMonth = isSameMonth(day, month)
          const isTodayDate = isToday(day)

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => handleSelect(day)}
              className={[
                'w-8 h-8 mx-auto flex items-center justify-center text-xs rounded-full transition-colors',
                isSelected
                  ? 'bg-[var(--accent)] text-white font-semibold'
                  : isTodayDate
                    ? 'ring-1 ring-[var(--accent)] text-[var(--accent)] font-medium hover:bg-[var(--surface-2)]'
                    : isCurrentMonth
                      ? 'text-[var(--label)] hover:bg-[var(--surface-2)]'
                      : 'text-[var(--label-3)] hover:bg-[var(--surface-2)]',
              ].join(' ')}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>

      {/* Time-of-day (reminders need a specific time, not just a date) —
          hour/minute chip columns instead of the native clock widget, so the
          time half of the picker reads like the calendar half above it. */}
      {includeTime && (
        <div className="mt-2 pt-2 border-t border-[var(--sep)]">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="w-3.5 h-3.5 text-[var(--label-3)] shrink-0" />
            <span className="text-xs font-semibold text-[var(--label)] tabular-nums">{time}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ml-auto text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-h)] transition-colors shrink-0"
            >
              Done
            </button>
          </div>
          <div className="flex gap-2">
            <TimeColumn
              label="HH"
              values={HOURS}
              selected={timeHour}
              onSelect={(h) => handleTimeChange(`${String(h).padStart(2, '0')}:${String(timeMinute).padStart(2, '0')}`)}
            />
            <TimeColumn
              label="MM"
              values={minuteValues}
              selected={timeMinute}
              onSelect={(m) => handleTimeChange(`${String(timeHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`)}
            />
          </div>
        </div>
      )}

      {/* Clear */}
      {selected && !hideClear && (
        <div className="mt-2 pt-2 border-t border-[var(--sep)] text-center">
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false) }}
            className="text-xs text-[var(--label-3)] hover:text-[var(--label)] transition-colors"
          >
            Clear date
          </button>
        </div>
      )}
    </div>
  ) : null

  return (
    <div className="relative w-full">
      <button
        ref={triggerRef}
        type="button"
        onClick={openDropdown}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm rounded-[10px] bg-[var(--surface-2)] border border-[var(--sep)] text-left focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-colors hover:border-[var(--accent)]"
      >
        <Calendar className="w-3.5 h-3.5 text-[var(--label-3)] shrink-0" />
        <span className={selected ? 'text-[var(--label)]' : 'text-[var(--label-3)]'}>
          {selected ? format(selected, includeTime ? 'MMM d, yyyy · HH:mm' : 'MMM d, yyyy') : placeholder}
        </span>
        {selected && !hideClear && (
          <span
            role="button"
            aria-label="Clear date"
            onClick={handleClear}
            className="ml-auto text-[var(--label-3)] hover:text-[var(--label)] leading-none cursor-pointer"
          >
            ×
          </span>
        )}
      </button>

      {typeof document !== 'undefined' && dropdown && createPortal(dropdown, document.body)}
    </div>
  )
}
