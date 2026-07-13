import { useState } from 'react'
import { Bell, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatDistanceToNow, addHours, addDays, setHours, setMinutes, isBefore } from 'date-fns'
import { es as esLocale, enUS } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { trpc } from '../../lib/trpc'
import { DatePicker } from './DatePicker'

const isPast = (iso: string) => new Date(iso).getTime() <= Date.now()

function buildPresets(t: (key: string) => string) {
  const now = new Date()
  const today8pm = setMinutes(setHours(now, 20), 0)
  const tonight = isBefore(now, today8pm) ? today8pm : setMinutes(setHours(addDays(now, 1), 20), 0)
  return [
    { key: 'hour', label: t('task.reminderPresetHour'), date: addHours(now, 1) },
    { key: 'tonight', label: t('task.reminderPresetTonight'), date: tonight },
    { key: 'tomorrow', label: t('task.reminderPresetTomorrow'), date: setMinutes(setHours(addDays(now, 1), 9), 0) },
    { key: 'nextWeek', label: t('task.reminderPresetNextWeek'), date: setMinutes(setHours(addDays(now, 7), 9), 0) },
  ]
}

export function ReminderSection({ taskId }: { taskId: string }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'es' ? esLocale : enUS
  const utils = trpc.useUtils()
  const remindersQuery = trpc.tasks.reminders.useQuery({ taskId })
  const taskReminders = remindersQuery.data ?? []

  const [newReminderDraft, setNewReminderDraft] = useState('')

  // Both caches must be invalidated together: `tasks.reminders` backs this
  // panel's own list, while `reminders.listAll` backs the global poller
  // (NotificationBell's dropdown/badge, TaskCard's bell) — invalidating only
  // the former leaves the bell showing stale data for up to the poller's 30s
  // refetch interval after an edit made here.
  const invalidateReminders = () =>
    Promise.all([utils.tasks.reminders.invalidate({ taskId }), utils.reminders.listAll.invalidate()])

  const createReminderMutation = trpc.reminders.create.useMutation({
    onSuccess: invalidateReminders,
    onError: () => toast.error(t('task.failedAddReminder')),
  })

  const updateReminderMutation = trpc.reminders.update.useMutation({
    onSuccess: invalidateReminders,
    onError: () => toast.error(t('task.failedUpdateReminder')),
  })

  const deleteReminderMutation = trpc.reminders.delete.useMutation({
    onSuccess: invalidateReminders,
    onError: () => toast.error(t('task.failedDeleteReminder')),
  })

  const handleAddPreset = (iso: string) => {
    createReminderMutation.mutate({ taskId, remindAt: iso })
  }

  const handleAddReminder = () => {
    if (!newReminderDraft) return
    if (isPast(newReminderDraft)) {
      toast.error(t('task.reminderInPast'))
      return
    }
    createReminderMutation.mutate({ taskId, remindAt: newReminderDraft })
    setNewReminderDraft('')
  }

  const handleUpdateReminder = (id: string, iso: string) => {
    if (!iso) return
    if (isPast(iso)) {
      toast.error(t('task.reminderInPast'))
      return
    }
    updateReminderMutation.mutate({ id, remindAt: iso })
  }

  const handleDeleteReminder = (reminderId: string) => {
    deleteReminderMutation.mutate({ id: reminderId })
  }

  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--label-3)] flex items-center gap-1.5 mb-2">
        <Bell className="w-3.5 h-3.5" /> {t('task.reminders')}
      </label>

      <div className="flex flex-wrap gap-1.5 mb-2">
        {buildPresets(t).map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => handleAddPreset(p.date.toISOString())}
            disabled={createReminderMutation.isPending}
            className="px-2.5 py-1 rounded-full text-xs bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label-2)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-50"
          >
            {p.label}
          </button>
        ))}
      </div>

      {taskReminders.length > 0 ? (
        <div className="space-y-1.5 mb-2">
          {taskReminders.map((r) => {
            const overdue = isPast(r.remindAt)
            return (
              <div key={r.id} className="flex items-center gap-2 group">
                <DatePicker
                  value={r.remindAt}
                  onChange={(iso) => handleUpdateReminder(r.id, iso)}
                  includeTime
                  hideClear
                />
                <span className={`text-xs shrink-0 ${overdue ? 'text-[var(--danger)]' : 'text-[var(--label-3)]'}`}>
                  {formatDistanceToNow(new Date(r.remindAt), { addSuffix: true, locale })}
                </span>
                <button
                  onClick={() => handleDeleteReminder(r.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded-[4px] hover:bg-[var(--surface-2)] transition-opacity shrink-0"
                >
                  <Trash2 className="w-3 h-3 text-[var(--label-3)]" />
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-xs text-[var(--label-3)] mb-2">{t('task.noReminders')}</p>
      )}

      <div className="flex items-center gap-2">
        <DatePicker
          value={newReminderDraft}
          onChange={setNewReminderDraft}
          includeTime
          placeholder={t('task.selectReminderDateTime')}
        />
        <button
          type="button"
          onClick={handleAddReminder}
          disabled={!newReminderDraft || createReminderMutation.isPending}
          className="px-3 py-2.5 text-sm font-semibold text-white bg-[var(--accent)] rounded-[10px] hover:bg-[var(--accent-h)] disabled:opacity-50 transition-colors shrink-0"
        >
          {t('task.addReminder')}
        </button>
      </div>
    </div>
  )
}
