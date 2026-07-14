import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MoreHorizontal, Plus, Pencil, Trash2, GripVertical, CheckCircle2, Circle } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TaskCard } from './TaskCard'
import type { Task, Column, Label } from '../../types'

interface KanbanColumnProps {
  column: Column
  tasks: Task[]
  labels: Label[]
  onAddTask: (columnId: string) => void
  onEditTask: (task: Task) => void
  onEditColumn: (column: Column) => void
  onDeleteColumn: (columnId: string) => void
  onToggleDone: (column: Column) => void
}

function SortableTaskCard({ task, labels, onClick }: { task: Task; labels: Label[]; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, data: { type: 'task' } })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} labels={labels} onClick={onClick} />
    </div>
  )
}

export function KanbanColumn({ column, tasks, labels, onAddTask, onEditTask, onEditColumn, onDeleteColumn, onToggleDone }: KanbanColumnProps) {
  const { t } = useTranslation()
  const [showMenu, setShowMenu] = useState(false)
  const sortedTasks = [...tasks].sort((a, b) => a.order - b.order)

  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: column.id, data: { type: 'column' } })

  // Preset columns are stored as i18n keys (e.g. "board.col.todo"); custom columns are plain strings
  const displayTitle = column.title.startsWith('board.col.') ? t(column.title) : column.title

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex flex-col w-72 shrink-0 rounded-[12px] p-3 transition-colors duration-150 bg-[var(--surface-2)]"
      {...attributes}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-0.5 rounded text-[var(--label-3)] hover:text-[var(--label-2)] hover:bg-[var(--surface-3)] transition-colors"
            title={t('kanban.dragColumn', 'Drag to reorder')}
          >
            <GripVertical className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-xs font-semibold text-[var(--label)] uppercase tracking-wider">
            {displayTitle}
          </h3>
          {column.isDone && (
            <CheckCircle2
              className="w-3.5 h-3.5 text-[var(--success)] shrink-0"
              aria-label={t('kanban.doneColumnBadge')}
            />
          )}
          <span className="text-[10px] font-semibold text-[var(--label-3)] bg-[var(--surface-3)] px-1.5 py-0.5 rounded-full">
            {sortedTasks.length}
          </span>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded-[6px] hover:bg-[var(--surface-3)] text-[var(--label-3)] transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-7 z-10 w-48 bg-[var(--surface)] border border-[var(--sep)] rounded-[10px] shadow-[0_4px_16px_rgba(0,0,0,0.08)] py-1 popover-enter">
              <button
                onClick={() => { onEditColumn(column); setShowMenu(false) }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--label)] hover:bg-[var(--surface-2)] transition-colors whitespace-nowrap"
              >
                <Pencil className="w-3 h-3 shrink-0" /> {t('common.rename')}
              </button>
              <button
                onClick={() => { onToggleDone(column); setShowMenu(false) }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--label)] hover:bg-[var(--surface-2)] transition-colors whitespace-nowrap"
              >
                {column.isDone
                  ? <><Circle className="w-3 h-3 shrink-0" /> {t('kanban.unmarkDoneColumn')}</>
                  : <><CheckCircle2 className="w-3 h-3 shrink-0" /> {t('kanban.markDoneColumn')}</>}
              </button>
              <button
                onClick={() => { onDeleteColumn(column.id); setShowMenu(false) }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--danger)] hover:bg-[var(--surface-2)] transition-colors whitespace-nowrap"
              >
                <Trash2 className="w-3 h-3 shrink-0" /> {t('common.delete')}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-2 min-h-[100px] rounded-[8px] stagger-cards">
        <SortableContext items={sortedTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {sortedTasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} labels={labels} onClick={() => onEditTask(task)} />
          ))}
        </SortableContext>
      </div>

      <button
        onClick={() => onAddTask(column.id)}
        className="flex items-center gap-2 w-full px-3 py-2 mt-2 text-sm text-[var(--label-3)] hover:bg-[var(--surface-3)] rounded-[8px] transition-[colors,transform] duration-[160ms] active:scale-[0.97]"
      >
        <Plus className="w-4 h-4" />
        {t('kanban.addTask')}
      </button>
    </div>
  )
}
