import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
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
import { getDateLocale } from '../../lib/dateLocale'

interface DatePickerProps {
  value: string
  onChange: (iso: string) => void
  placeholder?: string
  /** When true, also shows a time-of-day input and combines it into the emitted ISO string. */
  includeTime?: boolean
  /** Hide the "Clear date" affordance — for values that can't be null (e.g. an existing reminder). */
  hideClear?: boolean
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)
/** Gap between trigger and panel, and the minimum breathing room to any viewport edge. */
const PANEL_GAP = 6
const VIEWPORT_MARGIN = 8

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

export function DatePicker({ value, onChange, placeholder, includeTime = false, hideClear = false }: DatePickerProps) {
  const { t, i18n } = useTranslation()
  const locale = getDateLocale(i18n.language)
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => (value ? new Date(value) : new Date()))
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const dayHeaders = useMemo(() => {
    const ref = new Date()
    return eachDayOfInterval({ start: startOfWeek(ref), end: endOfWeek(ref) })
      .map((d) => format(d, 'EEEEEE', { locale }))
  }, [locale])

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
    setOpen((v) => !v)
  }

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month)),
    end: endOfWeek(endOfMonth(month)),
  })

  // The panel is `position: fixed`, so its coordinates only describe where the
  // trigger happens to be *right now*: any scroll, rotation or soft-keyboard
  // resize invalidates them. Measured (never estimated) and clamped to the
  // visible area, then re-run on every event that can move either the trigger
  // or the viewport. visualViewport is the one that reports the region the
  // mobile keyboard leaves visible — window.innerHeight doesn't shrink for it.
  const positionDropdown = useCallback(() => {
    const trigger = triggerRef.current
    const panel = containerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const vv = window.visualViewport
    const viewTop = vv?.offsetTop ?? 0
    const viewLeft = vv?.offsetLeft ?? 0
    const viewHeight = vv?.height ?? window.innerHeight
    const viewWidth = vv?.width ?? window.innerWidth
    const height = panel?.offsetHeight ?? 0
    const width = panel?.offsetWidth ?? 0

    let top = rect.bottom + PANEL_GAP
    if (top + height > viewTop + viewHeight - VIEWPORT_MARGIN) {
      const above = rect.top - height - PANEL_GAP
      top = above >= viewTop + VIEWPORT_MARGIN
        ? above
        : Math.max(viewTop + VIEWPORT_MARGIN, viewTop + viewHeight - height - VIEWPORT_MARGIN)
    }
    const left = Math.max(
      viewLeft + VIEWPORT_MARGIN,
      Math.min(rect.left, viewLeft + viewWidth - width - VIEWPORT_MARGIN),
    )
    setDropdownPos({ top, left })
  }, [])

  // Layout effect, so the measured position lands before the first paint.
  // `days.length` and `value` are deps because a 5- vs 6-row month grid and the
  // conditional Clear row both change the panel's height.
  useLayoutEffect(() => {
    if (open) positionDropdown()
  }, [open, positionDropdown, days.length, value, includeTime])

  useEffect(() => {
    if (!open) return
    const reposition = () => positionDropdown()
    // Capture phase: the trigger may live inside a scrolling panel/modal body,
    // whose scroll events don't bubble to window.
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    window.visualViewport?.addEventListener('resize', reposition)
    window.visualViewport?.addEventListener('scroll', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
      window.visualViewport?.removeEventListener('resize', reposition)
      window.visualViewport?.removeEventListener('scroll', reposition)
    }
  }, [open, positionDropdown])

  useEffect(() => {
    if (!open) return
    // pointerdown, not mousedown: on touch the synthetic mouse event only fires
    // after a delay (or not at all), leaving the panel stuck open on a phone.
    const handler = (e: PointerEvent) => {
      const target = e.target as Node
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [open])

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
      className="fixed z-[200] bg-[var(--surface)] border border-[var(--sep)] rounded-[var(--radius-xl)] shadow-[var(--shadow-xl)] p-3 w-64 max-w-[calc(100vw-1rem)] max-h-[85dvh] overflow-y-auto animate-modal-in"
      style={{ top: dropdownPos.top, left: dropdownPos.left }}
    >
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setMonth((m) => subMonths(m, 1))}
          className="tap-target p-1 rounded-[var(--radius-sm)] hover:bg-[var(--surface-2)] transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-[var(--label-2)]" />
        </button>
        <span className="text-sm font-semibold text-[var(--label)]">
          {format(month, 'MMMM yyyy', { locale })}
        </span>
        <button
          type="button"
          onClick={() => setMonth((m) => addMonths(m, 1))}
          className="tap-target p-1 rounded-[var(--radius-sm)] hover:bg-[var(--surface-2)] transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-[var(--label-2)]" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {dayHeaders.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-medium text-[var(--label-3)] py-1">
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
              className="tap-target ml-auto text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-h)] transition-colors shrink-0"
            >
              {t('datePicker.done')}
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
            className="tap-target text-xs text-[var(--label-3)] hover:text-[var(--label)] transition-colors"
          >
            {t('datePicker.clear')}
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
        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm rounded-[var(--radius-lg)] bg-[var(--surface-2)] border border-[var(--sep)] text-left focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-colors hover:border-[var(--accent)]"
      >
        <Calendar className="w-3.5 h-3.5 text-[var(--label-3)] shrink-0" />
        <span className={`min-w-0 truncate ${selected ? 'text-[var(--label)]' : 'text-[var(--label-3)]'}`}>
          {selected
            ? format(selected, includeTime ? 'd MMM yyyy · HH:mm' : 'd MMM yyyy', { locale })
            : placeholder ?? t('datePicker.placeholder')}
        </span>
        {selected && !hideClear && (
          <span
            role="button"
            aria-label={t('datePicker.clear')}
            onClick={handleClear}
            className="tap-target ml-auto text-[var(--label-3)] hover:text-[var(--label)] leading-none cursor-pointer"
          >
            ×
          </span>
        )}
      </button>

      {typeof document !== 'undefined' && dropdown && createPortal(dropdown, document.body)}
    </div>
  )
}
