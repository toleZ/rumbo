import { useState } from 'react'
import { format, isPast, isToday } from 'date-fns'
import { es as esLocale, enUS } from 'date-fns/locale'
import { useTranslation } from 'react-i18next'
import { Calendar, Flag, CheckSquare, Bell } from 'lucide-react'
import { useReminderStore } from '../../stores/reminderStore'
import { PriorityPill } from './PriorityPill'
import { LabelChip } from '../ui/LabelChip'
import { Checkbox } from '../ui/Checkbox'
import { useTaskCompletion } from '../../hooks/useTaskCompletion'
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

  const { hasDoneColumn, isDone, toggleComplete } = useTaskCompletion()
  const done = isDone(task)
  const [checkBounce, setCheckBounce] = useState(false)
  const handleToggleComplete = () => {
    setCheckBounce(true)
    window.setTimeout(() => setCheckBounce(false), 220)
    toggleComplete(task)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() }
      }}
      className="task-card w-full text-left bg-[var(--surface)] rounded-[var(--radius-lg)] border border-[var(--sep)] p-3 transition-[box-shadow,border-color,transform] duration-[180ms] shadow-[var(--shadow-xs)] active:scale-[0.98] cursor-pointer"
    >
      {taskLabels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {taskLabels.map((l) => (
            <LabelChip key={l.id} color={l.color} name={l.name} />
          ))}
        </div>
      )}

      <div className="flex items-start gap-2">
        {hasDoneColumn(task.boardId) && (
          <span onClick={(e) => e.stopPropagation()} className={`mt-0.5 shrink-0 ${checkBounce ? 'animate-check-bounce' : ''}`}>
            <Checkbox checked={done} shape="circle" onChange={handleToggleComplete} />
          </span>
        )}
        <p className={`text-sm font-medium task-title-strike ${done ? 'is-done text-[var(--label-3)]' : 'text-[var(--label)]'}`}>
          {task.title}
        </p>
      </div>

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
    </div>
  )
}
