import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { X } from 'lucide-react'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { DatePicker } from '../kanban/DatePicker'
import { Button } from '../ui/Button'
import type { Habit, HabitType, HabitSchedule } from '../../types'

const COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Yellow', value: '#eab308' },
]

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

export function HabitFormModal({
  habit,
  onClose,
  onSubmit,
}: {
  habit?: Habit
  onClose: () => void
  onSubmit: (data: Omit<Habit, 'id' | 'createdAt'>) => void
}) {
  const { t } = useTranslation()
  const isEdit = !!habit
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef)

  const [name, setName] = useState(habit?.name ?? '')
  const [type, setType] = useState<HabitType>(habit?.habitType ?? 'boolean')
  const [scheduleType, setScheduleType] = useState<HabitSchedule['type']>(habit?.schedule.type ?? 'daily')
  const [selectedDays, setSelectedDays] = useState<number[]>(
    habit?.schedule.type === 'specific_days' ? habit.schedule.days : [0, 1, 2, 3, 4, 5, 6],
  )
  const [timesPerWeek, setTimesPerWeek] = useState(
    habit?.schedule.type === 'times_per_week' ? habit.schedule.times : 3,
  )
  const [everyXDays, setEveryXDays] = useState(
    habit?.schedule.type === 'every_x_days' ? habit.schedule.days : 2,
  )
  const [xPerMonth, setXPerMonth] = useState(
    habit?.schedule.type === 'x_per_month' ? habit.schedule.times : 10,
  )
  const [target, setTarget] = useState(habit?.target != null ? String(habit.target) : '')
  const [unit, setUnit] = useState(habit?.unit ?? '')
  const [step, setStep] = useState(habit?.step != null ? String(habit.step) : '')
  const [startDate, setStartDate] = useState(habit?.startDate ?? '')
  const [endDate, setEndDate] = useState(habit?.endDate ?? '')
  const [color, setColor] = useState(habit?.color ?? COLORS[0].value)

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    const schedule: HabitSchedule =
      scheduleType === 'daily' ? { type: 'daily' }
      : scheduleType === 'specific_days' ? { type: 'specific_days', days: selectedDays }
      : scheduleType === 'times_per_week' ? { type: 'times_per_week', times: timesPerWeek }
      : scheduleType === 'every_x_days' ? { type: 'every_x_days', days: everyXDays }
      : { type: 'x_per_month', times: xPerMonth }

    const parsedTarget = type === 'measurable' && target ? parseFloat(target) : 1
    const parsedStep = step ? parseFloat(step) : null
    if (type === 'measurable' && parsedStep && parsedStep > parsedTarget) return

    onSubmit({
      name: name.trim(),
      habitType: type,
      schedule,
      target: type === 'measurable' && target ? parseFloat(target) : 1,
      unit: type === 'measurable' ? unit.trim() || '' : '',
      color,
      startDate: startDate || null,
      endDate: endDate || null,
      step: type === 'measurable' && parsedStep && parsedStep > 0 ? parsedStep : null,
    })
  }

  const inputCls = 'w-full px-3 py-2.5 text-sm rounded-[var(--radius-lg)] bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label)] placeholder:text-[var(--label-3)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]'
  const sectionLabel = 'block text-sm font-medium text-[var(--label-2)] mb-1.5'

  const scheduleOptions: { value: HabitSchedule['type']; label: string }[] = [
    { value: 'daily', label: t('habits.scheduleDaily') },
    { value: 'specific_days', label: t('habits.scheduleSpecificDays') },
    { value: 'times_per_week', label: t('habits.scheduleTimesPerWeek') },
    { value: 'every_x_days', label: t('habits.scheduleEveryXDays') },
    { value: 'x_per_month', label: t('habits.scheduleXPerMonth') },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="habit-modal-title"
        className="relative bg-[var(--surface)] rounded-[var(--radius-2xl)] shadow-[var(--shadow-xl)] border border-[var(--sep)] w-full max-w-md mx-4 overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--sep)] shrink-0">
          <h2 id="habit-modal-title" className="text-base font-semibold text-[var(--label)]">
            {isEdit ? t('habits.editTitle') : t('habits.newTitle')}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--surface-2)] transition-colors">
            <X className="w-4 h-4 text-[var(--label-3)]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Name */}
          <div>
            <label className={sectionLabel}>{t('habits.name')}</label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder={t('habits.namePlaceholder')} autoFocus className={inputCls}
            />
          </div>

          {/* Type */}
          <div>
            <label className={sectionLabel}>{t('habits.type')}</label>
            <div className="flex gap-2">
              {(['boolean', 'measurable'] as const).map((t_) => (
                <button
                  key={t_} type="button" onClick={() => setType(t_)}
                  className={`flex-1 px-3 py-2.5 text-sm font-medium rounded-[var(--radius-lg)] border transition-colors ${
                    type === t_
                      ? 'border-[var(--accent)] bg-[var(--accent-f)] text-[var(--accent)]'
                      : 'border-[var(--sep)] text-[var(--label-2)] hover:bg-[var(--surface-2)]'
                  }`}
                >
                  {t_ === 'boolean' ? t('habits.typeBoolean') : t('habits.typeMeasurable')}
                </button>
              ))}
            </div>
          </div>

          {/* Target + Unit + Step */}
          {type === 'measurable' && (
            <>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className={sectionLabel}>{t('habits.target')}</label>
                  <input
                    type="number" min="0" step="any"
                    value={target} onChange={(e) => setTarget(e.target.value)}
                    placeholder={t('habits.targetPlaceholder')} className={inputCls}
                  />
                </div>
                <div className="flex-1">
                  <label className={sectionLabel}>{t('habits.unit')}</label>
                  <input
                    type="text" value={unit} onChange={(e) => setUnit(e.target.value)}
                    placeholder={t('habits.unitPlaceholder')} className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={sectionLabel}>{t('habits.stepIncrement')}</label>
                <input
                  type="number" min="0.01" step="any"
                  value={step} onChange={(e) => setStep(e.target.value)}
                  placeholder={t('habits.stepPlaceholder')} className={inputCls}
                />
                {step && target && parseFloat(step) > parseFloat(target) ? (
                  <p className="text-xs text-[var(--danger)] mt-1.5">{t('habits.stepExceedsTarget')}</p>
                ) : (
                  <p className="text-xs text-[var(--label-3)] mt-1.5">{t('habits.stepHelp')}</p>
                )}
              </div>
            </>
          )}

          {/* Schedule */}
          <div>
            <label className={sectionLabel}>{t('habits.schedule')}</label>
            <div className="flex gap-2 mb-3 flex-wrap">
              {scheduleOptions.map((opt) => (
                <button
                  key={opt.value} type="button" onClick={() => setScheduleType(opt.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-[var(--radius-md)] border transition-colors ${
                    scheduleType === opt.value
                      ? 'border-[var(--accent)] bg-[var(--accent-f)] text-[var(--accent)]'
                      : 'border-[var(--sep)] text-[var(--label-2)] hover:bg-[var(--surface-2)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {scheduleType === 'specific_days' && (
              <div className="flex gap-1.5">
                {DAY_KEYS.map((key, idx) => (
                  <button
                    key={idx} type="button" onClick={() => toggleDay(idx)}
                    className={`w-9 h-9 rounded-[var(--radius-md)] text-xs font-semibold transition-colors ${
                      selectedDays.includes(idx)
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--surface-2)] text-[var(--label-2)] hover:bg-[var(--surface-3)]'
                    }`}
                    title={t(`habits.days.${key}`)}
                  >
                    {t(`habits.days.${key}`).charAt(0)}
                  </button>
                ))}
              </div>
            )}

            {scheduleType === 'times_per_week' && (
              <div className="flex items-center gap-3">
                <input
                  type="range" min="1" max="7"
                  value={timesPerWeek} onChange={(e) => setTimesPerWeek(parseInt(e.target.value))}
                  className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer accent-[var(--accent)] bg-[var(--surface-3)]"
                />
                <span className="text-sm font-semibold text-[var(--label)] w-20 text-right">
                  {t('habits.timesPerWeekLabel', { count: timesPerWeek })}
                </span>
              </div>
            )}

            {scheduleType === 'every_x_days' && (
              <div className="flex items-center gap-3">
                <input
                  type="range" min="2" max="30"
                  value={everyXDays} onChange={(e) => setEveryXDays(parseInt(e.target.value))}
                  className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer accent-[var(--accent)] bg-[var(--surface-3)]"
                />
                <span className="text-sm font-semibold text-[var(--label)] w-24 text-right">
                  {t('habits.everyXDaysLabel', { count: everyXDays })}
                </span>
              </div>
            )}

            {scheduleType === 'x_per_month' && (
              <div className="flex items-center gap-3">
                <input
                  type="range" min="1" max="31"
                  value={xPerMonth} onChange={(e) => setXPerMonth(parseInt(e.target.value))}
                  className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer accent-[var(--accent)] bg-[var(--surface-3)]"
                />
                <span className="text-sm font-semibold text-[var(--label)] w-20 text-right">
                  {t('habits.xPerMonthLabel', { count: xPerMonth })}
                </span>
              </div>
            )}
          </div>

          {/* Date Range */}
          <div>
            <label className={sectionLabel}>{t('habits.dateRange')}</label>
            <div className="flex gap-3">
              <div className="flex-1">
                <DatePicker
                  value={startDate}
                  onChange={(iso) => setStartDate(iso ? format(new Date(iso), 'yyyy-MM-dd') : '')}
                  placeholder={t('habits.startDate')}
                />
              </div>
              <div className="flex-1">
                <DatePicker
                  value={endDate}
                  onChange={(iso) => setEndDate(iso ? format(new Date(iso), 'yyyy-MM-dd') : '')}
                  placeholder={t('habits.endDate')}
                />
              </div>
            </div>
          </div>

          {/* Color */}
          <div>
            <label className={sectionLabel}>{t('habits.color')}</label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.value} type="button" onClick={() => setColor(c.value)}
                  className={`w-8 h-8 rounded-full transition-transform ${
                    color === c.value ? 'scale-110 ring-2 ring-offset-2 ring-offset-[var(--surface)]' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.value, ...(color === c.value ? { outline: `2px solid ${c.value}` } : {}) }}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1 text-[var(--label)]">
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={!name.trim()} className="flex-1">
              {isEdit ? t('habits.saveChanges') : t('habits.addHabit')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
