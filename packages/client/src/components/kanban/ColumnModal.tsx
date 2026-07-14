import { useState } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/Button'
import type { Column } from '../../types'

interface ColumnModalProps {
  column: Column | null
  onClose: () => void
  onSave: (title: string, isDone: boolean) => void
}

export function ColumnModal({ column, onClose, onSave }: ColumnModalProps) {
  const { t } = useTranslation()
  // Resolve i18n key to display name so the input shows "To-Do" not "board.col.todo"
  const resolvedTitle = column?.title
    ? (column.title.startsWith('board.col.') ? t(column.title) : column.title)
    : ''
  const [title, setTitle] = useState(resolvedTitle)
  const [isDone, setIsDone] = useState(column?.isDone ?? false)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-overlay-in" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-[var(--surface)] rounded-[var(--radius-2xl)] shadow-[var(--shadow-xl)] border border-[var(--sep)] p-6 animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-[var(--label)]">
            {column ? t('kanban.renameColumn') : t('kanban.newColumn')}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--surface-2)] transition-colors">
            <X className="w-4 h-4 text-[var(--label-3)]" />
          </button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (title.trim()) onSave(title.trim(), isDone) }}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
            placeholder={t('kanban.columnTitlePlaceholder')}
            className="w-full px-3 py-2.5 text-sm rounded-[var(--radius-lg)] bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label)] placeholder:text-[var(--label-3)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] mb-4"
          />
          {column && (
            <div className="flex items-start gap-2.5 mb-5">
              <input
                type="checkbox"
                id="column-is-done"
                checked={isDone}
                onChange={(e) => setIsDone(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded-[var(--radius-xs)] accent-[var(--accent)] shrink-0 cursor-pointer"
              />
              <label htmlFor="column-is-done" className="text-sm text-[var(--label)] cursor-pointer select-none">
                <span className="block font-medium leading-tight">{t('kanban.markDoneColumn')}</span>
                <span className="block text-xs text-[var(--label-3)] mt-0.5 leading-snug">{t('kanban.markAsDoneHint')}</span>
              </label>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} className="text-[var(--label)]">
              {t('common.cancel')}
            </Button>
            <Button type="submit">{t('common.save')}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
