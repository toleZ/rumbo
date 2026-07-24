import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Column } from '../../types'

interface BoardColumnSwitcherProps {
  columns: Column[]
  activeIndex: number
  taskCounts: Record<string, number>
  onChange: (index: number) => void
}

/**
 * Mobile-only column pager for the Kanban board.
 *
 * Below md the board shows one column at a time — four 288px columns cannot
 * coexist on a 375px screen, and horizontal scrolling them fights the vertical
 * scroll of the task list inside each one. This gives an explicit position
 * ("2 / 4"), prev/next stepping, and a tap-to-jump chip row.
 */
export function BoardColumnSwitcher({ columns, activeIndex, taskCounts, onChange }: BoardColumnSwitcherProps) {
  const { t } = useTranslation()
  if (columns.length === 0) return null

  const atStart = activeIndex <= 0
  const atEnd = activeIndex >= columns.length - 1
  const title = (c: Column) => (c.title.startsWith('board.col.') ? t(c.title) : c.title)

  return (
    <div className="md:hidden shrink-0 border-b border-[var(--sep)] bg-[var(--bg)]">
      <div className="flex items-center gap-1 px-2 py-2">
        <button
          onClick={() => onChange(activeIndex - 1)}
          disabled={atStart}
          className="tap-target p-2 rounded-[var(--radius-md)] text-[var(--label-2)] hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:pointer-events-none transition-[background-color,transform] duration-[160ms] active:scale-[0.97]"
          aria-label={t('kanban.previousColumn')}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0 text-center">
          <p className="truncate text-sm font-semibold text-[var(--label)]">
            {title(columns[activeIndex])}
          </p>
          <p className="text-[11px] text-[var(--label-3)] tabular-nums">
            {t('kanban.columnPosition', { current: activeIndex + 1, total: columns.length })}
          </p>
        </div>

        <button
          onClick={() => onChange(activeIndex + 1)}
          disabled={atEnd}
          className="tap-target p-2 rounded-[var(--radius-md)] text-[var(--label-2)] hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:pointer-events-none transition-[background-color,transform] duration-[160ms] active:scale-[0.97]"
          aria-label={t('kanban.nextColumn')}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Direct-jump chips — stepping through 6 columns one tap at a time is
          the kind of friction that makes people stop using the board. */}
      <div className="flex gap-1.5 overflow-x-auto px-2 pb-2">
        {columns.map((column, i) => (
          <button
            key={column.id}
            onClick={() => onChange(i)}
            aria-current={i === activeIndex}
            className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              i === activeIndex
                ? 'bg-[var(--accent-f)] text-[var(--accent-h)]'
                : 'bg-[var(--surface-2)] text-[var(--label-2)]'
            }`}
          >
            <span className="max-w-24 truncate">{title(column)}</span>
            <span className="tabular-nums text-[var(--label-3)]">{taskCounts[column.id] ?? 0}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
