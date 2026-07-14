import { useEffect, useRef, useState } from 'react'
import { Bell, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatDistanceToNow } from 'date-fns'
import { getDateLocale } from '../../lib/dateLocale'
import { useReminderStore, type ReminderInfo } from '../../stores/reminderStore'
import { useTaskStore } from '../../stores/taskStore'
import { useUIStore } from '../../stores/uiStore'
import { trpc } from '../../lib/trpc'

export function NotificationBell() {
  const { t, i18n } = useTranslation()
  const locale = getDateLocale(i18n.language)

  const remindersByTask = useReminderStore((s) => s.remindersByTask)
  const dueTaskIds = useReminderStore((s) => s.dueTaskIds)
  const clearDue = useReminderStore((s) => s.clearDue)
  const setActiveBoard = useTaskStore((s) => s.setActiveBoard)
  const setPage = useUIStore((s) => s.setPage)
  const setSelectedTaskId = useUIStore((s) => s.setSelectedTaskId)
  const utils = trpc.useUtils()

  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // The bell stays open across a task-navigation click (which switches
  // board/page), so unlike the sidebar's board menu this needs an explicit
  // outside-click handler rather than relying on the triggering action to
  // close it.
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const deleteReminderMutation = trpc.reminders.delete.useMutation({
    onSuccess: () => utils.reminders.listAll.invalidate(),
  })

  const allReminders = Object.values(remindersByTask).flat()
  const now = Date.now()
  const overdue = allReminders
    .filter((r) => new Date(r.remindAt).getTime() <= now)
    .sort((a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime())
  const upcoming = allReminders
    .filter((r) => new Date(r.remindAt).getTime() > now)
    .sort((a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime())

  const handleOpenTask = (r: ReminderInfo) => {
    setActiveBoard(r.boardId)
    setSelectedTaskId(r.taskId)
    setPage('kanban')
    clearDue(r.taskId)
    setIsOpen(false)
  }

  const handleDelete = (e: React.MouseEvent, reminderId: string) => {
    e.stopPropagation()
    deleteReminderMutation.mutate({ id: reminderId })
  }

  const renderRow = (r: ReminderInfo, isOverdue: boolean) => (
    <div
      key={r.id}
      onClick={() => handleOpenTask(r)}
      className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--surface-2)] cursor-pointer group"
    >
      <div className="flex-1 min-w-0">
        <p className="text-[var(--label)] truncate">{r.taskTitle}</p>
        <p className={`text-xs ${isOverdue ? 'text-[var(--danger)]' : 'text-[var(--label-3)]'}`}>
          {formatDistanceToNow(new Date(r.remindAt), { addSuffix: true, locale })}
        </p>
      </div>
      <button
        onClick={(e) => handleDelete(e, r.id)}
        className="opacity-0 group-hover:opacity-100 p-1 rounded-[6px] hover:bg-[var(--surface-3)] transition-opacity shrink-0"
        aria-label={t('common.delete')}
      >
        <Trash2 className="w-3 h-3 text-[var(--label-3)]" />
      </button>
    </div>
  )

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="p-1.5 rounded-[8px] hover:bg-[var(--surface-2)] text-[var(--label-3)] transition-colors relative"
        aria-label={t('notifications.open')}
        title={t('notifications.open')}
      >
        <Bell className="w-4 h-4" />
        {dueTaskIds.size > 0 && (
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[var(--danger)]" />
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-9 z-30 w-80 bg-[var(--surface)] border border-[var(--sep)] rounded-[10px] shadow-[0_4px_16px_rgba(0,0,0,0.08)] py-1 popover-enter max-h-96 overflow-y-auto">
          <div className="px-3 py-2 border-b border-[var(--sep)]">
            <span className="text-xs font-semibold uppercase text-[var(--label-3)] tracking-wider">
              {t('notifications.title')}
            </span>
          </div>

          {allReminders.length === 0 ? (
            <p className="px-3 py-6 text-sm text-center text-[var(--label-3)]">{t('notifications.empty')}</p>
          ) : (
            <>
              {overdue.length > 0 && (
                <div>
                  <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase text-[var(--danger)] tracking-wider">
                    {t('notifications.overdue')}
                  </p>
                  {overdue.map((r) => renderRow(r, true))}
                </div>
              )}
              {upcoming.length > 0 && (
                <div>
                  <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase text-[var(--label-3)] tracking-wider">
                    {t('notifications.upcoming')}
                  </p>
                  {upcoming.map((r) => renderRow(r, false))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
