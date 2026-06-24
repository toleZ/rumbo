import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { es as esLocale, enUS } from 'date-fns/locale'
import { CheckCircle2, Clock, AlertTriangle, TrendingUp, Timer, Kanban, Sun, Target, ArrowRight } from 'lucide-react'
import { useTaskStore } from '../../stores/taskStore'
import { useUIStore } from '../../stores/uiStore'
import { usePomodoroStore } from '../../stores/pomodoroStore'

export function HomePage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'es' ? esLocale : enUS
  const { tasks, columns } = useTaskStore()
  const { sessionsCompleted } = usePomodoroStore()
  const today = new Date()
  const totalTasks = tasks.length
  const inProgress = tasks.filter((task) => {
    const col = columns.find((c) => c.id === task.columnId)
    return col?.title.toLowerCase().includes('progress') || col?.title.toLowerCase().includes('doing')
  }).length
  const overdue = tasks.filter((task) => task.dueDate && new Date(task.dueDate) < today).length
  const upcoming = tasks
    .filter((task) => task.dueDate && new Date(task.dueDate) >= today)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 5)

  function getGreeting(): string {
    const hour = new Date().getHours()
    if (hour < 12) return t('home.greeting.morning')
    if (hour < 18) return t('home.greeting.afternoon')
    return t('home.greeting.evening')
  }

  const isEmpty = tasks.length === 0

  return (
    <div className="h-full overflow-y-auto bg-[var(--bg)]">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--label)]">
            {getGreeting()}
          </h1>
          <p className="text-sm text-[var(--label-2)] mt-1">{format(today, 'EEEE, MMMM d, yyyy', { locale })}</p>
        </div>

        {isEmpty ? (
          <OnboardingPanel />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 stagger-children">
              <StatCard icon={<TrendingUp className="w-4 h-4 text-[var(--accent)]" />} label={t('home.totalTasks')} value={totalTasks} color="text-[var(--accent)]" />
              <StatCard icon={<CheckCircle2 className="w-4 h-4 text-[var(--success)]" />} label={t('home.inProgress')} value={inProgress} color="text-[var(--success)]" />
              <StatCard icon={<AlertTriangle className="w-4 h-4 text-[var(--danger)]" />} label={t('home.overdue')} value={overdue} color="text-[var(--danger)]" />
              <StatCard icon={<Timer className="w-4 h-4 text-[var(--warning)]" />} label={t('home.pomodorosToday')} value={sessionsCompleted} color="text-[var(--warning)]" />
            </div>

            <div className="bg-[var(--surface)] rounded-[12px] border border-[var(--sep)] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--label-3)] mb-4 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" />
                {t('home.upcomingDeadlines')}
              </h3>
              {upcoming.length === 0 ? (
                <p className="text-sm text-[var(--label-3)]">{t('home.noUpcoming')}</p>
              ) : (
                <div className="divide-y divide-[var(--sep)] stagger-children">
                  {upcoming.map((task) => (
                    <div key={task.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--label)] truncate">{task.title}</p>
                        <p className="text-xs text-[var(--label-3)] mt-0.5">
                          {task.dueDate && format(new Date(task.dueDate), 'MMM d, yyyy', { locale })}
                        </p>
                      </div>
                      <PriorityBadge priority={task.priority} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function OnboardingPanel() {
  const { t } = useTranslation()
  const { setPage } = useUIStore()

  const steps = [
    {
      icon: <Kanban className="w-4 h-4 text-[var(--accent)]" />,
      title: t('home.onboard.boardTitle'),
      body: t('home.onboard.boardBody'),
      cta: t('home.onboard.boardCta'),
      action: () => setPage('kanban'),
    },
    {
      icon: <Sun className="w-4 h-4 text-[var(--accent)]" />,
      title: t('home.onboard.todayTitle'),
      body: t('home.onboard.todayBody'),
      cta: t('home.onboard.todayCta'),
      action: () => setPage('today'),
    },
    {
      icon: <Target className="w-4 h-4 text-[var(--accent)]" />,
      title: t('home.onboard.habitsTitle'),
      body: t('home.onboard.habitsBody'),
      cta: t('home.onboard.habitsCta'),
      action: () => setPage('habits'),
    },
  ]

  return (
    <div className="bg-[var(--surface)] rounded-[16px] border border-[var(--sep)] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="px-6 py-5 border-b border-[var(--sep)]">
        <h2 className="text-sm font-semibold text-[var(--label)]">{t('home.onboard.title')}</h2>
        <p className="text-sm text-[var(--label-2)] mt-0.5">{t('home.onboard.subtitle')}</p>
      </div>
      <div className="divide-y divide-[var(--sep)]">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4">
            <div className="w-8 h-8 rounded-[8px] bg-[var(--accent-f)] flex items-center justify-center shrink-0">
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

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="bg-[var(--surface)] rounded-[12px] border border-[var(--sep)] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-[var(--label-3)] font-medium">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function PriorityBadge({ priority }: { priority?: string | null }) {
  const { t } = useTranslation()
  const styles: Record<string, string> = {
    urgent: 'bg-[rgba(255,59,48,0.10)] text-[var(--danger)]',
    high:   'bg-[rgba(255,149,0,0.10)] text-[var(--warning)]',
    medium: 'bg-[var(--surface-2)] text-[var(--label-3)]',
    low:    'bg-[var(--surface-2)] text-[var(--label-3)]',
  }
  const cls = styles[priority ?? 'low'] ?? styles.low
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-[6px] ml-3 ${cls}`}>
      {priority ? t(`priority.${priority}`) : priority}
    </span>
  )
}
