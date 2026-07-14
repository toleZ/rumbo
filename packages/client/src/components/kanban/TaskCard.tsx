import { format, isPast, isToday } from 'date-fns'
import { es as esLocale, enUS } from 'date-fns/locale'
import { useTranslation } from 'react-i18next'
import { Calendar, Flag, CheckSquare, Bell } from 'lucide-react'
import { useReminderStore } from '../../stores/reminderStore'
import { PriorityPill } from './PriorityPill'
import type { Task, Label } from '../../types'

interface TaskCardProps {
  task: Task
  labels: Label[]
  onClick: () => void
}

export function TaskCard({ task, labels, onClick }: TaskCardProps) {
  const { i18n } = useTranslation()
  const locale = i18n.language === 'es' ? esLocale : enUS
  const taskLabels = labels.filter((l) => task.labels.includes(l.id))
  const completedSubtasks = task.subtasks.filter((s) => s.completed).length
  const totalSubtasks = task.subtasks.length
  const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate))
  const hasReminders = useReminderStore((s) => (s.remindersByTask[task.id]?.length ?? 0) > 0)
  const reminderDue = useReminderStore((s) => s.dueTaskIds.has(task.id))

  return (
    <button
      type="button"
      onClick={onClick}
      className="task-card w-full text-left bg-[var(--surface)] rounded-[10px] border border-[var(--sep)] p-3 transition-[box-shadow,border-color,transform] duration-[180ms] shadow-[0_1px_2px_rgba(0,0,0,0.04)] active:scale-[0.98]"
    >
      {taskLabels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {taskLabels.map((l) => (
            <span
              key={l.id}
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white"
              style={{ backgroundColor: l.color }}
            >
              {l.name}
            </span>
          ))}
        </div>
      )}

      <p className="text-sm font-medium text-[var(--label)]">{task.title}</p>

      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <PriorityPill priority={task.priority} />

        {task.scheduledDate && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-[var(--label-3)]">
            <Calendar className="w-3 h-3" />
            {format(new Date(task.scheduledDate), 'MMM d', { locale })}
          </span>
        )}
        {task.dueDate && (
          <span className={`flex items-center gap-1 text-[10px] font-medium ${isOverdue ? 'text-[var(--danger)]' : 'text-[var(--label-3)]'}`}>
            <Flag className="w-3 h-3" />
            {format(new Date(task.dueDate), 'MMM d', { locale })}
          </span>
        )}

        {totalSubtasks > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-[var(--label-3)] font-medium">
            <CheckSquare className="w-3 h-3" />
            {completedSubtasks}/{totalSubtasks}
          </span>
        )}

        {hasReminders && (
          <Bell
            className={`w-3 h-3 ${reminderDue ? 'text-[var(--danger)] animate-pulse' : 'text-[var(--label-3)]'}`}
            aria-label="Has a reminder"
          />
        )}
      </div>
    </button>
  )
}
