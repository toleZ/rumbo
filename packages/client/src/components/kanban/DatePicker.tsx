import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
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
}

const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export function DatePicker({ value, onChange, placeholder = 'Pick a date' }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => (value ? new Date(value) : new Date()))
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = value ? new Date(value) : null

  const openDropdown = () => {
    if (!open && selected) setMonth(selected)
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setDropdownPos({ top: rect.bottom + 6, left: rect.left, width: rect.width })
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
    onChange(day.toISOString())
    setOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
  }

  const dropdown = open ? (
    <div
      ref={containerRef}
      className="fixed z-[200] bg-[var(--surface)] border border-[var(--sep)] rounded-[12px] shadow-[0_8px_30px_rgba(0,0,0,0.15)] p-3 w-64"
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

      {/* Clear */}
      {selected && (
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
          {selected ? format(selected, 'MMM d, yyyy') : placeholder}
        </span>
        {selected && (
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
