import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  format, getDay, subDays, addDays, isAfter, isSameDay, startOfDay,
} from 'date-fns'
import { es as esLocale, enUS } from 'date-fns/locale'
import { Plus, Check, FastForward, Target } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useHabitStore } from '../../stores/habitStore'
import { trpc } from '../../lib/trpc'
import type { Habit, HabitException } from '../../types'
import { isHabitScheduledForDay, getScheduleLabel } from '../../lib/habits/scheduleLogic'
import { calculateStreak } from '../../lib/habits/streakLogic'
import { HabitFormModal } from './HabitFormModal'
import { HabitActionModal } from './HabitActionModal'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'

const HABITS_DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

function playCompletionSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const now = ctx.currentTime
    const frequencies = [523.25, 659.25, 783.99]
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now)
      const start = now + i * 0.1
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.25, start + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5)
      osc.start(start)
      osc.stop(start + 0.5)
    })
  } catch {}
}

function confettiFromPoint(x: number, y: number) {
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:100'
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const colors = ['#3b82f6', '#22c55e', '#a855f7', '#f97316', '#ef4444', '#eab308', '#ec4899', '#14b8a6']
  const particles = Array.from({ length: 40 }, () => {
    const angle = Math.random() * Math.PI * 2
    const speed = 2 + Math.random() * 6
    return {
      x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 3,
      size: 4 + Math.random() * 4, color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1, rotation: Math.random() * 360, rotationSpeed: (Math.random() - 0.5) * 10,
    }
  })
  let frame = 0
  const maxFrames = 60
  function animate() {
    frame++
    if (frame > maxFrames) { document.body.removeChild(canvas); return }
    ctx!.clearRect(0, 0, canvas.width, canvas.height)
    particles.forEach((p) => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.15
      p.alpha = Math.max(0, 1 - frame / maxFrames)
      p.rotation += p.rotationSpeed
      ctx!.save()
      ctx!.translate(p.x, p.y)
      ctx!.rotate((p.rotation * Math.PI) / 180)
      ctx!.globalAlpha = p.alpha
      ctx!.fillStyle = p.color
      ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
      ctx!.restore()
    })
    requestAnimationFrame(animate)
  }
  animate()
}

export function HabitsPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'es' ? esLocale : enUS
  const {
    habits, completions, exceptions,
    addHabit, updateHabit, deleteHabit,
    toggleCompletion, setMeasurableValue, removeCompletion,
    addException, removeException,
  } = useHabitStore(useShallow(s => ({
    habits: s.habits,
    completions: s.completions,
    exceptions: s.exceptions,
    addHabit: s.addHabit,
    updateHabit: s.updateHabit,
    deleteHabit: s.deleteHabit,
    toggleCompletion: s.toggleCompletion,
    setMeasurableValue: s.setMeasurableValue,
    removeCompletion: s.removeCompletion,
    addException: s.addException,
    removeException: s.removeException,
  })))

  const [showAddModal, setShowAddModal] = useState(false)
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null)
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()))
  const [measurablePopup, setMeasurablePopup] = useState<{
    habitId: string; dateKey: string; x: number; y: number
  } | null>(null)
  const [measurableInput, setMeasurableInput] = useState('')
  const measurableRef = useRef<HTMLInputElement>(null)
  const [actionModalHabit, setActionModalHabit] = useState<Habit | null>(null)

  const utils = trpc.useUtils()
  const createMutation = trpc.habits.create.useMutation({ onSuccess: () => utils.habits.list.invalidate() })
  const updateMutation = trpc.habits.update.useMutation({ onSuccess: () => utils.habits.list.invalidate() })
  const deleteMutation = trpc.habits.delete.useMutation({ onSuccess: () => utils.habits.list.invalidate() })
  const logCompletionMutation = trpc.habits.logCompletion.useMutation({ onSuccess: () => utils.habits.list.invalidate() })
  const removeCompletionMutation = trpc.habits.removeCompletion.useMutation({ onSuccess: () => utils.habits.list.invalidate() })
  const logExceptionMutation = trpc.habits.logException.useMutation({ onSuccess: () => utils.habits.list.invalidate() })
  const removeExceptionMutation = trpc.habits.removeException.useMutation({ onSuccess: () => utils.habits.list.invalidate() })

  const today = startOfDay(new Date())
  const isFutureDate = isAfter(selectedDate, today)
  const dateKey = format(selectedDate, 'yyyy-MM-dd')
  const windowDays = Array.from({ length: 7 }, (_, i) => addDays(selectedDate, i - 3))
  const activeHabits = habits.filter((h) => {
    if (isHabitScheduledForDay(h, selectedDate, exceptions)) return true
    if (isSameDay(selectedDate, today)) {
      return exceptions[h.id]?.[dateKey]?.type === 'postponed'
    }
    return false
  })

  useEffect(() => {
    if (measurablePopup && measurableRef.current) measurableRef.current.focus()
  }, [measurablePopup])

  const handleAddHabit = useCallback(async (params: Omit<Habit, 'id' | 'createdAt'>) => {
    addHabit(params)
    setShowAddModal(false)
    try {
      await createMutation.mutateAsync({
        name: params.name, habitType: params.habitType, schedule: params.schedule,
        target: params.target, unit: params.unit, color: params.color,
        startDate: params.startDate, endDate: params.endDate, step: params.step,
      })
    } catch (err) { console.error('Failed to create habit:', err) }
  }, [addHabit, createMutation])

  const handleDeleteHabit = useCallback(async (habitId: string) => {
    deleteHabit(habitId)
    try {
      await deleteMutation.mutateAsync({ id: habitId })
    } catch (err) { console.error('Failed to delete habit:', err) }
  }, [deleteHabit, deleteMutation])

  const handleBooleanClick = useCallback(async (e: React.MouseEvent, habit: Habit) => {
    if (isFutureDate) return
    const wasCompleted = completions[habit.id]?.[dateKey]?.completed ?? false
    toggleCompletion(habit.id, dateKey)
    if (!wasCompleted) { playCompletionSound(); confettiFromPoint(e.clientX, e.clientY) }
    try {
      if (!wasCompleted) {
        await logCompletionMutation.mutateAsync({ habitId: habit.id, date: dateKey, value: 1 })
      } else {
        await removeCompletionMutation.mutateAsync({ habitId: habit.id, date: dateKey })
      }
    } catch (err) {
      toggleCompletion(habit.id, dateKey)
      console.error('Failed to save completion:', err)
    }
  }, [completions, dateKey, isFutureDate, toggleCompletion, logCompletionMutation, removeCompletionMutation])

  const handleMeasurableClick = useCallback((e: React.MouseEvent, habit: Habit) => {
    if (isFutureDate) return
    if (habit.step !== null && habit.step !== undefined) {
      const current = completions[habit.id]?.[dateKey]?.value ?? 0
      const newValue = current + habit.step
      setMeasurableValue(habit.id, dateKey, newValue)
      if (habit.target != null && newValue >= habit.target) { playCompletionSound(); confettiFromPoint(e.clientX, e.clientY) }
      logCompletionMutation.mutateAsync({ habitId: habit.id, date: dateKey, value: newValue }).catch(console.error)
      return
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const existing = completions[habit.id]?.[dateKey]?.value
    setMeasurableInput(existing != null && existing > 0 ? String(existing) : '')
    setMeasurablePopup({ habitId: habit.id, dateKey, x: rect.left + rect.width / 2, y: rect.bottom + 4 })
  }, [completions, dateKey, isFutureDate, setMeasurableValue, logCompletionMutation])

  const submitMeasurable = useCallback(async () => {
    if (!measurablePopup) return
    const val = parseFloat(measurableInput)
    if (!isNaN(val) && val >= 0) {
      const habit = habits.find((h) => h.id === measurablePopup.habitId)
      setMeasurableValue(measurablePopup.habitId, measurablePopup.dateKey, val)
      if (habit && habit.target != null && val >= habit.target) {
        playCompletionSound(); confettiFromPoint(measurablePopup.x, measurablePopup.y - 20)
      }
      try {
        await logCompletionMutation.mutateAsync({ habitId: measurablePopup.habitId, date: measurablePopup.dateKey, value: val })
      } catch (err) { console.error('Failed to save measurable value:', err) }
    }
    setMeasurablePopup(null)
    setMeasurableInput('')
  }, [measurablePopup, measurableInput, habits, setMeasurableValue, logCompletionMutation])

  const handlePostpone = useCallback(async (habit: Habit) => {
    if (!isSameDay(selectedDate, today)) return
    const tempEx: HabitException = { id: crypto.randomUUID(), habitId: habit.id, date: dateKey, type: 'postponed' }
    addException(tempEx)
    try {
      await logExceptionMutation.mutateAsync({ habitId: habit.id, date: dateKey, type: 'postponed' })
    } catch (err) {
      removeException(habit.id, dateKey)
      console.error('Failed to postpone habit:', err)
    }
  }, [selectedDate, today, dateKey, addException, removeException, logExceptionMutation])

  const submitSkip = useCallback(async (habitId: string, note: string) => {
    const tempEx: HabitException = { id: crypto.randomUUID(), habitId, date: dateKey, type: 'skipped', note: note || undefined }
    addException(tempEx)
    setActionModalHabit(null)
    try {
      await logExceptionMutation.mutateAsync({ habitId, date: dateKey, type: 'skipped', note: note || undefined })
    } catch (err) {
      removeException(habitId, dateKey)
      console.error('Failed to skip habit:', err)
    }
  }, [dateKey, addException, removeException, logExceptionMutation])

  const handleUndoException = useCallback(async (habit: Habit) => {
    removeException(habit.id, dateKey)
    try {
      await removeExceptionMutation.mutateAsync({ habitId: habit.id, date: dateKey })
    } catch (err) { console.error('Failed to undo exception:', err) }
  }, [dateKey, removeException, removeExceptionMutation])

  const handleEditSave = useCallback(async (updates: Omit<Habit, 'id' | 'createdAt'>) => {
    if (!editingHabit) return
    updateHabit(editingHabit.id, updates)
    setEditingHabit(null)
    try {
      await updateMutation.mutateAsync({
        id: editingHabit.id, name: updates.name, habitType: updates.habitType,
        schedule: updates.schedule, target: updates.target, unit: updates.unit,
        color: updates.color, startDate: updates.startDate, endDate: updates.endDate, step: updates.step,
      })
    } catch (err) {
      updateHabit(editingHabit.id, editingHabit)
      console.error('Failed to update habit:', err)
    }
  }, [editingHabit, updateHabit, updateMutation])

  return (
    <div className="h-full overflow-y-auto bg-[var(--bg)]">
      <div className="max-w-xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[var(--label)]">
            {isSameDay(selectedDate, today) ? t('calendar.today') : format(selectedDate, 'MMMM d, yyyy', { locale })}
          </h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="p-2 bg-[var(--accent)] text-white rounded-full hover:bg-[var(--accent-h)] transition-colors shadow-[0_2px_8px_rgba(0,122,255,0.25)]"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Date Timeline */}
        <div className="flex items-center justify-between mb-8 relative px-2">
          <div className="absolute top-[34px] left-8 right-8 h-[2px] bg-[var(--sep)] -z-10" />
          {windowDays.map((day) => {
            const isSelected = isSameDay(day, selectedDate)
            const isPastOrToday = !isAfter(day, today)
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={`flex flex-col items-center gap-2 group transition-all z-10 ${isSelected ? 'scale-110' : 'hover:scale-105'}`}
              >
                <span className={`text-[10px] uppercase font-semibold ${isSelected ? 'text-[var(--label)]' : 'text-[var(--label-3)]'}`}>
                  {t(`habits.days.${HABITS_DAY_KEYS[getDay(day)]}`)}
                </span>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${
                  isSelected
                    ? 'bg-[var(--accent)] text-white ring-4 ring-[var(--bg)]'
                    : isPastOrToday
                      ? 'bg-[var(--surface)] border-2 border-[var(--accent)] text-[var(--label)]'
                      : 'bg-[var(--surface-2)] border-2 border-[var(--sep)] text-[var(--label-3)]'
                }`}>
                  {format(day, 'd')}
                </div>
              </button>
            )
          })}
        </div>

        {/* Habits list */}
        {activeHabits.length === 0 ? (
          <EmptyState
            icon={Target}
            title={t('habits.emptyState')}
            description={t('habits.emptyStateDesc')}
            action={<Button className="mt-1" onClick={() => setShowAddModal(true)}>{t('habits.addHabit')}</Button>}
          />
        ) : (
          <div className="space-y-3">
            {activeHabits.map((habit) => {
              const { current } = calculateStreak(habit, completions, exceptions, selectedDate, today)
              const entry = completions[habit.id]?.[dateKey]
              const isCompleted = entry?.completed ?? false
              const value = entry?.value ?? 0
              const ex = exceptions[habit.id]?.[dateKey]
              const yesterdayKey = format(subDays(selectedDate, 1), 'yyyy-MM-dd')
              const isPostponedFromYesterday = exceptions[habit.id]?.[yesterdayKey]?.type === 'postponed'
              const isPostponed = ex?.type === 'postponed'
              const isSkipped = ex?.type === 'skipped'

              let progress = 0
              if (habit.habitType === 'measurable' && habit.target) {
                progress = Math.min(100, (value / habit.target) * 100)
              } else if (habit.habitType === 'boolean' && isCompleted) {
                progress = 100
              }

              return (
                <div
                  key={habit.id}
                  className="relative bg-[var(--surface)] rounded-[var(--radius-xl)] border border-[var(--sep)] hover:border-[var(--accent)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all overflow-hidden cursor-pointer active:bg-[var(--surface-2)]"
                  onClick={() => setActionModalHabit(habit)}
                >
                  {isPostponedFromYesterday && (
                    <div className="px-4 pt-2.5 pb-0 flex items-center gap-1.5">
                      <FastForward className="w-3 h-3 text-[var(--warning)]" />
                      <span className="text-xs font-semibold text-[var(--warning)]">{t('habits.postponed')}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 py-3 px-4">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base shrink-0"
                      style={{ backgroundColor: habit.color }}
                    >
                      {habit.name.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--label)] truncate">{habit.name}</p>
                      <div className="flex items-center gap-1.5 text-xs text-[var(--label-3)] mt-0.5">
                        <span>{getScheduleLabel(habit.schedule, t)}</span>
                        {habit.habitType === 'measurable' && habit.target != null && (
                          <span>· {value}/{habit.target} {habit.unit}</span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {isPostponed ? (
                        <span className="text-xs font-semibold text-[var(--warning)] px-2 py-1 rounded-[var(--radius-md)] bg-[rgba(255,149,0,0.1)]">
                          {t('habits.postponed')}
                        </span>
                      ) : isSkipped ? (
                        <span className="text-xs font-semibold text-[var(--label-3)] px-2 py-1 rounded-[var(--radius-md)] bg-[var(--surface-2)]">
                          {t('habits.skipped')}
                        </span>
                      ) : habit.habitType === 'boolean' ? (
                        <div className="relative">
                          <button
                            onClick={(e) => handleBooleanClick(e, habit)}
                            disabled={isFutureDate}
                            className="w-9 h-9 rounded-full border-[2.5px] flex items-center justify-center transition-all hover:scale-105 disabled:opacity-50"
                            style={{ borderColor: habit.color, backgroundColor: isCompleted ? habit.color : 'transparent' }}
                          >
                            {isCompleted && <Check className="w-5 h-5 text-white" strokeWidth={3} />}
                          </button>
                          {current > 0 && (
                            <div
                              className="absolute -top-1.5 -right-1.5 text-white text-[10px] font-bold px-1.5 min-w-[20px] h-5 rounded-full flex items-center justify-center shadow-sm"
                              style={{ backgroundColor: habit.color }}
                              title={t('habits.dayStreak', { count: current })}
                            >
                              {current}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="relative">
                          <button
                            onClick={(e) => handleMeasurableClick(e, habit)}
                            disabled={isFutureDate}
                            className="relative w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-105 disabled:opacity-50"
                            style={{ color: progress >= 100 ? '#ffffff' : habit.color, backgroundColor: progress >= 100 ? habit.color : 'transparent' }}
                          >
                            <Plus className="w-5 h-5" strokeWidth={3} />
                            {progress < 100 && (
                              <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
                                <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-20" />
                                <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="2.5"
                                  strokeDasharray={2 * Math.PI * 15.5}
                                  strokeDashoffset={2 * Math.PI * 15.5 * (1 - progress / 100)}
                                  className="transition-all duration-500" strokeLinecap="round" />
                              </svg>
                            )}
                          </button>
                          {current > 0 && (
                            <div
                              className="absolute -top-1.5 -right-1.5 text-white text-[10px] font-bold px-1.5 min-w-[20px] h-5 rounded-full flex items-center justify-center shadow-sm"
                              style={{ backgroundColor: habit.color }}
                              title={t('habits.dayStreak', { count: current })}
                            >
                              {current}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {progress > 0 && !isSkipped && !isPostponed && (
                    <div className="h-1 bg-[var(--surface-2)]">
                      <div
                        className="h-full transition-all duration-500 ease-out rounded-r-full"
                        style={{ width: `${progress}%`, backgroundColor: habit.color }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Measurable value popup */}
      {measurablePopup && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setMeasurablePopup(null); setMeasurableInput('') }} />
          <div
            className="fixed z-50 bg-[var(--surface)] rounded-[var(--radius-lg)] shadow-[0_4px_16px_rgba(0,0,0,0.08)] border border-[var(--sep)] p-3"
            style={{ left: measurablePopup.x, top: measurablePopup.y, transform: 'translateX(-50%)' }}
          >
            <form onSubmit={(e) => { e.preventDefault(); submitMeasurable() }} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  ref={measurableRef}
                  type="number" min="0" step="any"
                  value={measurableInput}
                  onChange={(e) => setMeasurableInput(e.target.value)}
                  placeholder={t('habits.valuePlaceholder')}
                  className="w-20 px-2 py-1.5 text-sm rounded-[var(--radius-md)] bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label)] placeholder:text-[var(--label-3)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
                <span className="text-xs font-medium text-[var(--label-3)]">
                  {habits.find((h) => h.id === measurablePopup.habitId)?.unit || ''}
                </span>
                <Button type="submit" size="sm">{t('habits.save')}</Button>
              </div>
              <button
                type="button"
                onClick={() => { setMeasurablePopup(null); setMeasurableInput('') }}
                className="text-xs text-center text-[var(--label-3)] hover:text-[var(--label-2)] transition-colors"
              >
                {t('common.cancel')}
              </button>
            </form>
          </div>
        </>
      )}

      {actionModalHabit && (
        <HabitActionModal
          habit={actionModalHabit}
          isToday={isSameDay(selectedDate, today)}
          isFutureDate={isFutureDate}
          isPostponed={exceptions[actionModalHabit.id]?.[dateKey]?.type === 'postponed'}
          isSkipped={exceptions[actionModalHabit.id]?.[dateKey]?.type === 'skipped'}
          existingSkipNote={exceptions[actionModalHabit.id]?.[dateKey]?.note}
          isCompleted={completions[actionModalHabit.id]?.[dateKey]?.completed ?? false}
          currentValue={completions[actionModalHabit.id]?.[dateKey]?.value ?? 0}
          onClose={() => setActionModalHabit(null)}
          onSkip={submitSkip}
          onPostpone={async () => {
            const h = actionModalHabit
            setActionModalHabit(null)
            await handlePostpone(h)
          }}
          onUndoException={() => {
            handleUndoException(actionModalHabit)
            setActionModalHabit(null)
          }}
          onEdit={() => { setEditingHabit(actionModalHabit); setActionModalHabit(null) }}
          onDelete={() => { handleDeleteHabit(actionModalHabit.id); setActionModalHabit(null) }}
          onUndoCompletion={() => {
            const h = actionModalHabit
            toggleCompletion(h.id, dateKey)
            setActionModalHabit(null)
            removeCompletionMutation.mutateAsync({ habitId: h.id, date: dateKey }).catch(() => toggleCompletion(h.id, dateKey))
          }}
          onDecrement={() => {
            const h = actionModalHabit
            if (h.step == null) return
            const current = completions[h.id]?.[dateKey]?.value ?? 0
            const next = Math.max(0, current - h.step)
            if (next === 0) {
              removeCompletion(h.id, dateKey)
              removeCompletionMutation.mutateAsync({ habitId: h.id, date: dateKey }).catch(console.error)
            } else {
              setMeasurableValue(h.id, dateKey, next)
              logCompletionMutation.mutateAsync({ habitId: h.id, date: dateKey, value: next }).catch(console.error)
            }
          }}
        />
      )}

      {showAddModal && (
        <HabitFormModal onClose={() => setShowAddModal(false)} onSubmit={handleAddHabit} />
      )}
      {editingHabit && (
        <HabitFormModal habit={editingHabit} onClose={() => setEditingHabit(null)} onSubmit={handleEditSave} />
      )}
    </div>
  )
}
