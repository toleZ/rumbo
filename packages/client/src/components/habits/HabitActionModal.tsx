import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, RotateCcw, CalendarClock, ChevronRight, Trash2, Ban, X, Minus } from 'lucide-react'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { getScheduleLabel } from '../../lib/habits/scheduleLogic'
import type { Habit } from '../../types'

export function HabitActionModal({
  habit,
  isToday,
  isFutureDate,
  isPostponed,
  isSkipped,
  isCompleted,
  currentValue,
  onClose,
  onSkip,
  onPostpone,
  onUndoException,
  onEdit,
  onDelete,
  onUndoCompletion,
  onDecrement,
  existingSkipNote,
}: {
  habit: Habit
  isToday: boolean
  isFutureDate: boolean
  isPostponed: boolean
  isSkipped: boolean
  isCompleted: boolean
  currentValue: number
  onClose: () => void
  onSkip: (habitId: string, note: string) => void
  onPostpone: () => void
  onUndoException: () => void
  onEdit: () => void
  onDelete: () => void
  onUndoCompletion: () => void
  onDecrement: () => void
  existingSkipNote?: string
}) {
  const { t } = useTranslation()
  const [view, setView] = useState<'menu' | 'skip' | 'postpone' | 'delete'>('menu')
  const [skipNote, setSkipNote] = useState('')
  const skipInputRef = useRef<HTMLInputElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  useFocusTrap(sheetRef)

  useEffect(() => {
    if (view === 'skip') skipInputRef.current?.focus()
  }, [view])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (view !== 'menu') setView('menu')
        else onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [view, onClose])

  // `group` on each row: the icon nudges right and the trailing chevron slides
  // in on hover — same hover language as the sidebar board rows.
  const rowCls = 'group flex items-center gap-3 px-5 py-3.5 w-full text-left hover:bg-[var(--surface-2)] active:bg-[var(--surface-3)] transition-colors cursor-pointer select-none'
  const rowIconCls = 'w-4 h-4 shrink-0 transition-transform duration-[160ms] group-hover:translate-x-0.5'
  const chevronCls = 'w-4 h-4 shrink-0 -translate-x-0.5 opacity-60 transition-[opacity,transform] duration-[160ms] group-hover:translate-x-0 group-hover:opacity-100'
  const btnCls = 'flex-1 px-4 py-2.5 text-sm font-medium rounded-[10px] transition-[background-color,opacity,transform] duration-[160ms] active:scale-[0.97]'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-overlay-in" onClick={onClose} />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        className="relative w-full sm:w-80 bg-[var(--surface)] rounded-t-[20px] sm:rounded-[16px] shadow-[0_-4px_40px_rgba(0,0,0,0.12)] sm:shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-[var(--sep)] overflow-hidden animate-sheet-up sm:animate-modal-in"
      >
        <div className="h-1" style={{ backgroundColor: habit.color }} />

        <div className="flex justify-center pt-2.5 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-[var(--surface-3)]" />
        </div>

        {view === 'menu' && (
          <div key="menu" className="view-enter">
            <div className="flex items-center gap-3 px-5 py-4">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                style={{ backgroundColor: habit.color }}
              >
                {habit.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--label)] truncate">{habit.name}</p>
                <p className="text-xs text-[var(--label-3)] mt-0.5">{getScheduleLabel(habit.schedule, t)}</p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-[8px] hover:bg-[var(--surface-2)] transition-[background-color,transform] duration-[160ms] active:scale-90 shrink-0"
              >
                <X className="w-4 h-4 text-[var(--label-3)]" />
              </button>
            </div>

            <div className="border-t border-[var(--sep)]" />

            <button className={rowCls} onClick={onEdit}>
              <Pencil className={`${rowIconCls} text-[var(--label-3)]`} />
              <span className="flex-1 text-sm font-medium text-[var(--label)]">{t('common.edit')}</span>
            </button>

            {isToday && !isSkipped && (
              isPostponed ? (
                <button className={rowCls} onClick={onUndoException}>
                  <RotateCcw className={`${rowIconCls} text-[var(--warning)]`} />
                  <span className="flex-1 text-sm font-medium text-[var(--label)]">{t('habits.undoPostpone')}</span>
                </button>
              ) : (
                <button className={rowCls} onClick={() => setView('postpone')}>
                  <CalendarClock className={`${rowIconCls} text-[var(--label-3)]`} />
                  <span className="flex-1 text-sm font-medium text-[var(--label)]">{t('habits.postpone')}</span>
                  <ChevronRight className={`${chevronCls} text-[var(--label-3)]`} />
                </button>
              )
            )}

            {!isFutureDate && !isPostponed && (
              isSkipped ? (
                <>
                  {existingSkipNote && (
                    <div className="mx-4 my-3 px-3 py-2.5 rounded-[10px] bg-[var(--surface-2)]">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--label-3)] mb-1">{t('habits.skipReasonLabel')}</p>
                      <p className="text-sm text-[var(--label)] leading-snug">{existingSkipNote}</p>
                    </div>
                  )}
                  <button className={rowCls} onClick={onUndoException}>
                    <RotateCcw className={`${rowIconCls} text-[var(--label-3)]`} />
                    <span className="flex-1 text-sm font-medium text-[var(--label)]">{t('habits.undoSkip')}</span>
                  </button>
                </>
              ) : (
                <button className={rowCls} onClick={() => setView('skip')}>
                  <Ban className={`${rowIconCls} text-[var(--label-3)]`} />
                  <span className="flex-1 text-sm font-medium text-[var(--label)]">{t('habits.skip')}</span>
                  <ChevronRight className={`${chevronCls} text-[var(--label-3)]`} />
                </button>
              )
            )}

            {habit.habitType === 'boolean' && isCompleted && !isFutureDate && !isSkipped && !isPostponed && (
              <button className={rowCls} onClick={onUndoCompletion}>
                <RotateCcw className={`${rowIconCls} text-[var(--label-3)]`} />
                <span className="flex-1 text-sm font-medium text-[var(--label)]">{t('habits.undoCompletion')}</span>
              </button>
            )}

            {habit.habitType === 'measurable' && habit.step != null && currentValue > 0 && !isFutureDate && !isSkipped && !isPostponed && (
              <button className={rowCls} onClick={onDecrement}>
                <Minus className={`${rowIconCls} text-[var(--label-3)]`} />
                <span className="flex-1 text-sm font-medium text-[var(--label)]">{t('habits.reduce')}</span>
                <span className="text-xs font-semibold tabular-nums text-[var(--label-3)]">−{habit.step}{habit.unit ? ` ${habit.unit}` : ''}</span>
              </button>
            )}

            <div className="border-t border-[var(--sep)]" />

            <button className={rowCls} onClick={() => setView('delete')}>
              <Trash2 className={`${rowIconCls} text-[var(--danger)]`} />
              <span className="flex-1 text-sm font-medium text-[var(--danger)]">{t('common.delete')}</span>
              <ChevronRight className={`${chevronCls} text-[var(--danger)]`} />
            </button>

            <div className="pb-4 sm:pb-2" />
          </div>
        )}

        {view === 'skip' && (
          <div className="p-5 view-enter">
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => { setView('menu'); setSkipNote('') }}
                className="p-1 rounded-[6px] hover:bg-[var(--surface-2)] text-[var(--label-3)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <h3 className="text-sm font-semibold text-[var(--label)]">{t('habits.skip')}</h3>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); onSkip(habit.id, skipNote) }}>
              <p className="text-xs text-[var(--label-3)] mb-2">{t('habits.skipNote')}</p>
              <input
                ref={skipInputRef}
                type="text"
                value={skipNote}
                onChange={(e) => setSkipNote(e.target.value)}
                placeholder={t('habits.skipNotePlaceholder')}
                className="w-full px-3 py-2.5 text-sm rounded-[10px] bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label)] placeholder:text-[var(--label-3)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-shadow duration-[160ms] mb-3"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => { setView('menu'); setSkipNote('') }}
                  className={`${btnCls} text-[var(--label)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)]`}>
                  {t('common.cancel')}
                </button>
                <button type="submit"
                  className={`${btnCls} font-semibold text-white bg-[var(--danger)] hover:opacity-90`}>
                  {t('habits.skipConfirm')}
                </button>
              </div>
            </form>
            <div className="pb-4 sm:pb-0" />
          </div>
        )}

        {view === 'postpone' && (
          <div className="p-5 view-enter">
            <p className="text-sm font-semibold text-[var(--label)] mb-1">{t('habits.postpone')}</p>
            <p className="text-xs text-[var(--label-3)] mb-4 truncate">"{habit.name}"</p>
            <div className="flex gap-2">
              <button onClick={() => setView('menu')}
                className={`${btnCls} text-[var(--label)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)]`}>
                {t('common.cancel')}
              </button>
              <button onClick={onPostpone}
                className={`${btnCls} font-semibold text-white bg-[var(--warning)] hover:opacity-90`}>
                {t('habits.postponeConfirm')}
              </button>
            </div>
            <div className="pb-4 sm:pb-0" />
          </div>
        )}

        {view === 'delete' && (
          <div className="p-5 view-enter">
            <p className="text-sm font-semibold text-[var(--label)] mb-1">{t('habits.deleteHabit')}</p>
            <p className="text-xs text-[var(--label-3)] mb-4 truncate">"{habit.name}"</p>
            <div className="flex gap-2">
              <button onClick={() => setView('menu')}
                className={`${btnCls} text-[var(--label)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)]`}>
                {t('common.cancel')}
              </button>
              <button onClick={onDelete}
                className={`${btnCls} font-semibold text-white bg-[var(--danger)] hover:opacity-90`}>
                {t('common.delete')}
              </button>
            </div>
            <div className="pb-4 sm:pb-0" />
          </div>
        )}
      </div>
    </div>
  )
}
