import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format, isToday, isPast, isBefore, isAfter, startOfDay, endOfDay, addDays, isWithinInterval } from 'date-fns'
import { es as esLocale, enUS } from 'date-fns/locale'
import {
  Calendar, CheckCircle2, Circle, Plus, Bell, Timer, Target, Kanban, ArrowRight,
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useTaskStore } from '../../stores/taskStore'
import { useUIStore } from '../../stores/uiStore'
import { useAuthStore } from '../../stores/authStore'
import { useHabitStore } from '../../stores/habitStore'
import { useReminderStore, type ReminderInfo } from '../../stores/reminderStore'
import { useActionRingStore } from '../../stores/actionRingStore'
import { isHabitScheduledForDay } from '../../lib/habits/scheduleLogic'
import { calculateStreak } from '../../lib/habits/streakLogic'
import { TaskPanel } from '../kanban/TaskPanel'
import { TaskModal } from '../kanban/TaskModal'
import { PriorityPill } from '../kanban/PriorityPill'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import type { Task } from '../../types'

function isActiveToday(t: Task): boolean {
  const today = new Date()
  const s = t.scheduledDate ? new Date(t.scheduledDate) : null
  const d = t.dueDate ? new Date(t.dueDate) : null
  if (s && d) return !isBefore(today, startOfDay(s)) && !isAfter(today, endOfDay(d))
  if (s) return isToday(s)
  if (d) return isToday(d)
  return false
}

function isOverdueTask(t: Task): boolean {
  return !!t.dueDate && isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate))
}

function openFocusRing() {
  useActionRingStore.getState().setExpanded(true)
  useActionRingStore.getState().setActiveWidget('pomodoro')
}

export function TodayPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'es' ? esLocale : enUS
  const { tasks, columns, boards, activeBoardId, setActiveBoard } = useTaskStore(useShallow(s => ({
    tasks: s.tasks,
    columns: s.columns,
    boards: s.boards,
    activeBoardId: s.activeBoardId,
    setActiveBoard: s.setActiveBoard,
  })))
  const setPage = useUIStore((s) => s.setPage)
  const user = useAuthStore((s) => s.user)
  const firstName = user?.name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? ''
  const now = new Date()
  const todayKey = format(now, 'yyyy-MM-dd')

  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [showCreateTask, setShowCreateTask] = useState(false)

  const doneColumnIds = new Set(columns.filter((c) => c.isDone).map((c) => c.id))
  const activeTasks = tasks.filter((t) => (t.scheduledDate || t.dueDate) && !doneColumnIds.has(t.columnId))

  const overdue = activeTasks
    .filter(isOverdueTask)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())

  const dueToday = activeTasks.filter((t) => !isOverdueTask(t) && isActiveToday(t))

  const todayTaskItems = [
    ...overdue.map((task) => ({ task, isOverdue: true })),
    ...dueToday.map((task) => ({ task, isOverdue: false })),
  ]

  const upcoming = activeTasks
    .filter((t) => {
      if (isOverdueTask(t) || isActiveToday(t)) return false
      const start = t.scheduledDate ? new Date(t.scheduledDate) : new Date(t.dueDate!)
      return !isPast(start) && !isToday(start) && isWithinInterval(start, { start: now, end: addDays(now, 7) })
    })
    .sort((a, b) => {
      const aDate = a.scheduledDate ?? a.dueDate!
      const bDate = b.scheduledDate ?? b.dueDate!
      return new Date(aDate).getTime() - new Date(bDate).getTime()
    })

  const { habits, completions, exceptions, toggleCompletion } = useHabitStore(useShallow(s => ({
    habits: s.habits,
    completions: s.completions,
    exceptions: s.exceptions,
    toggleCompletion: s.toggleCompletion,
  })))
  const todayHabits = habits.filter((h) => isHabitScheduledForDay(h, now, exceptions))
  const habitsCompletedCount = todayHabits.filter((h) => completions[h.id]?.[todayKey]?.completed).length

  const remindersByTask = useReminderStore((s) => s.remindersByTask)
  const clearDue = useReminderStore((s) => s.clearDue)
  const allReminders = Object.values(remindersByTask).flat()
  const dueReminders = allReminders
    .filter((r) => new Date(r.remindAt).getTime() <= now.getTime())
    .sort((a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime())
  const upcomingReminders = allReminders
    .filter((r) => {
      const t = new Date(r.remindAt).getTime()
      return t > now.getTime() && t <= addDays(now, 1).getTime()
    })
    .sort((a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime())

  const getColumnName = (columnId: string) => {
    const col = columns.find((c) => c.id === columnId)
    if (!col) return ''
    return col.title.startsWith('board.col.') ? t(col.title) : col.title
  }

  const handleTaskClick = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (task?.boardId) setActiveBoard(task.boardId)
    setOpenTaskId(taskId)
  }

  const handleReminderClick = (r: ReminderInfo) => {
    handleTaskClick(r.taskId)
    clearDue(r.taskId)
  }

  const defaultCreateColumn = (() => {
    const boardId = activeBoardId ?? boards[0]?.id
    return columns
      .filter((c) => c.boardId === boardId)
      .sort((a, b) => a.order - b.order)[0] ?? null
  })()

  const canCreate = boards.length > 0 && defaultCreateColumn !== null

  function getGreeting(): string {
    const hour = now.getHours()
    if (hour < 12) return t('today.greeting.morning')
    if (hour < 18) return t('today.greeting.afternoon')
    return t('today.greeting.evening')
  }

  const isEmpty = boards.length === 0

  return (
    <div className="h-full overflow-y-auto bg-[var(--bg)]">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--label-3)] mb-1">
              {format(now, 'EEEE, d MMMM', { locale })}
            </p>
            <h1 className="text-3xl font-bold text-[var(--label)]">
              {getGreeting()}{firstName ? `, ${firstName}` : ''}
            </h1>
          </div>
          {canCreate && (
            <Button onClick={() => setShowCreateTask(true)} icon={<Plus className="w-4 h-4" />} className="shrink-0">
              {t('today.newTask')}
            </Button>
          )}
        </div>

        {isEmpty ? (
          <OnboardingPanel />
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8 items-start">
              <div className="lg:col-span-2 bg-[var(--surface)] rounded-[var(--radius-xl)] border border-[var(--sep)] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--sep)]">
                  <h2 className="text-base font-semibold text-[var(--label)] flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[var(--accent)]" />
                    {t('today.tasksToday')}
                  </h2>
                  <span className="text-xs text-[var(--label-3)] shrink-0 ml-3">{t('today.pending', { count: todayTaskItems.length })}</span>
                </div>
                {todayTaskItems.length === 0 ? (
                  <EmptyState icon={CheckCircle2} title={t('today.nothingHere')} size="sm" />
                ) : (
                  <div className="divide-y divide-[var(--sep)]">
                    {todayTaskItems.map(({ task, isOverdue: overdueFlag }) => {
                      const board = boards.find((b) => b.id === task.boardId)
                      return (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => handleTaskClick(task.id)}
                          className="w-full flex items-center gap-3 py-3.5 px-5 hover:bg-[var(--surface-2)] transition-colors text-left"
                        >
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-medium text-[var(--label)] truncate">{task.title}</span>
                            <span className="block text-xs text-[var(--label-3)] truncate">
                              {board?.name}{board?.name ? ' · ' : ''}{getColumnName(task.columnId)}
                            </span>
                          </span>
                          <PriorityPill priority={task.priority} />
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                              overdueFlag
                                ? 'bg-[rgba(255,59,48,0.10)] text-[var(--danger)]'
                                : 'bg-[var(--accent-f)] text-[var(--accent)]'
                            }`}
                          >
                            {overdueFlag ? t('today.overdue') : t('today.pillToday')}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4">
                <DashboardCard icon={<Bell className="w-4 h-4 text-[var(--accent)]" />} title={t('today.reminders')}>
                  {dueReminders.length === 0 && upcomingReminders.length === 0 ? (
                    <EmptyState icon={Bell} title={t('today.remindersEmpty')} size="sm" />
                  ) : (
                    <div className="divide-y divide-[var(--sep)]">
                      {[...dueReminders, ...upcomingReminders].map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => handleReminderClick(r)}
                          className="w-full flex items-center justify-between py-2.5 px-4 hover:bg-[var(--surface-2)] transition-colors text-left"
                        >
                          <span className="text-sm font-medium text-[var(--label)] truncate">{r.taskTitle}</span>
                          <span className={`text-xs shrink-0 ml-3 ${new Date(r.remindAt).getTime() <= now.getTime() ? 'text-[var(--danger)]' : 'text-[var(--label-3)]'}`}>
                            {format(new Date(r.remindAt), 'MMM d, HH:mm', { locale })}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </DashboardCard>

                <DashboardCard
                  icon={<Target className="w-4 h-4 text-[var(--success)]" />}
                  title={t('today.checkpoints')}
                  meta={todayHabits.length > 0 ? `${habitsCompletedCount}/${todayHabits.length}` : undefined}
                >
                  {todayHabits.length === 0 ? (
                    <EmptyState icon={Target} title={t('today.checkpointsEmpty')} size="sm" />
                  ) : (
                    <div className="divide-y divide-[var(--sep)]">
                      {todayHabits.map((h) => {
                        const c = completions[h.id]?.[todayKey]
                        const done = c?.completed ?? false
                        const streak = calculateStreak(h, completions, exceptions, now).current
                        const isMilestone = streak >= 7 && streak % 7 === 0
                        return (
                          <button
                            key={h.id}
                            type="button"
                            onClick={() => h.habitType === 'boolean' ? toggleCompletion(h.id, todayKey) : setPage('habits')}
                            className="w-full flex items-center gap-2.5 py-2 px-4 hover:bg-[var(--surface-2)] transition-colors text-left"
                          >
                            <span className="w-6 h-6 rounded-[var(--radius-sm)] shrink-0" style={{ backgroundColor: h.color }} />
                            <span className="flex-1 min-w-0">
                              <span className="block text-sm font-medium text-[var(--label)] truncate">{h.name}</span>
                              <span className={`block text-xs ${isMilestone ? 'font-semibold text-[var(--energy)]' : 'text-[var(--label-3)]'}`}>
                                {t('today.habitStreak', { count: streak })}
                              </span>
                            </span>
                            {h.habitType === 'measurable' && (
                              <span className="text-xs text-[var(--label-3)] shrink-0">{c?.value ?? 0}/{h.target}{h.unit}</span>
                            )}
                            {done
                              ? <CheckCircle2 className="w-4 h-4 text-[var(--success)] shrink-0" />
                              : <Circle className="w-4 h-4 text-[var(--label-3)] shrink-0" />}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </DashboardCard>

                <DashboardCard icon={<Calendar className="w-4 h-4 text-[var(--label-3)]" />} title={t('today.agenda')}>
                  {upcoming.length === 0 ? (
                    <EmptyState icon={Calendar} title={t('today.nothingHere')} size="sm" />
                  ) : (
                    <div className="relative py-1">
                      {upcoming.map((task) => {
                        const board = boards.find((b) => b.id === task.boardId)
                        const dateStr = task.scheduledDate
                          ? format(new Date(task.scheduledDate), 'MMM d', { locale })
                          : task.dueDate
                            ? format(new Date(task.dueDate), 'MMM d', { locale })
                            : ''
                        return (
                          <button
                            key={task.id}
                            type="button"
                            onClick={() => handleTaskClick(task.id)}
                            className="relative w-full flex items-center gap-3 py-2 px-4 hover:bg-[var(--surface-2)] transition-colors text-left"
                          >
                            <span
                              className="relative z-10 w-2.5 h-2.5 rounded-full shrink-0 ring-4 ring-[var(--surface)]"
                              style={{ backgroundColor: board?.color ?? 'var(--label-3)' }}
                            />
                            <span className="flex-1 min-w-0 text-sm font-medium text-[var(--label)] truncate">{task.title}</span>
                            <span className="text-xs text-[var(--label-3)] font-mono shrink-0">{dateStr}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </DashboardCard>
              </div>
            </div>
          </>
        )}
      </div>

      {showCreateTask && defaultCreateColumn && (
        <TaskModal
          task={null}
          columnId={defaultCreateColumn.id}
          boardId={defaultCreateColumn.boardId}
          showBoardPicker
          onClose={() => setShowCreateTask(false)}
        />
      )}

      {openTaskId && (
        <TaskPanel
          taskId={openTaskId}
          onClose={() => setOpenTaskId(null)}
        />
      )}
    </div>
  )
}

function DashboardCard({ icon, title, meta, children }: { icon: React.ReactNode; title: string; meta?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <Card.Header icon={icon} title={title} meta={meta} />
      {children}
    </Card>
  )
}

function OnboardingPanel() {
  const { t } = useTranslation()
  const { setPage, openCreateBoardModal } = useUIStore(useShallow(s => ({ setPage: s.setPage, openCreateBoardModal: s.openCreateBoardModal })))

  const steps = [
    {
      icon: <Kanban className="w-4 h-4 text-[var(--accent)]" />,
      title: t('today.onboard.boardTitle'),
      body: t('today.onboard.boardBody'),
      cta: t('today.onboard.boardCta'),
      action: openCreateBoardModal,
    },
    {
      icon: <Target className="w-4 h-4 text-[var(--accent)]" />,
      title: t('today.onboard.habitsTitle'),
      body: t('today.onboard.habitsBody'),
      cta: t('today.onboard.habitsCta'),
      action: () => setPage('habits'),
    },
    {
      icon: <Timer className="w-4 h-4 text-[var(--accent)]" />,
      title: t('today.onboard.focusTitle'),
      body: t('today.onboard.focusBody'),
      cta: t('today.onboard.focusCta'),
      action: openFocusRing,
    },
  ]

  return (
    <div className="bg-[var(--surface)] rounded-[var(--radius-2xl)] border border-[var(--sep)] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="px-6 py-5 border-b border-[var(--sep)]">
        <h2 className="text-sm font-semibold text-[var(--label)]">{t('today.onboard.title')}</h2>
        <p className="text-sm text-[var(--label-2)] mt-0.5">{t('today.onboard.subtitle')}</p>
      </div>
      <div className="divide-y divide-[var(--sep)]">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4">
            <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--accent-f)] flex items-center justify-center shrink-0">
              {step.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--label)]">{step.title}</p>
              <p className="text-xs text-[var(--label-2)] mt-0.5">{step.body}</p>
            </div>
            <button
              onClick={step.action}
              className="shrink-0 flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:opacity-75 transition-opacity"
            >
              {step.cta}
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
