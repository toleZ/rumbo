import { useState } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BOARD_SWATCH_COLORS } from '../../lib/swatchColors'
import { Button } from '../ui/Button'
import type { BoardTemplate } from '../../types'

interface BoardTemplateModalProps {
  onClose: () => void
  onSave: (name: string, color: string | null, columns: string[]) => void
}

export function BoardTemplateModal({ onClose, onSave }: BoardTemplateModalProps) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<string>('simple')
  const [color, setColor] = useState<string | null>(null)

  // columns holds i18n keys — resolved at render time in KanbanColumn so language switches work
  const TEMPLATES: BoardTemplate[] = [
    { id: 'simple',   name: t('board.templateSimple'),   columns: ['board.col.todo', 'board.col.inProgress', 'board.col.done'] },
    { id: 'detailed', name: t('board.templateDetailed'), columns: ['board.col.backlog', 'board.col.todo', 'board.col.inProgress', 'board.col.review', 'board.col.done'] },
    { id: 'studies',  name: t('board.templateStudies'),  columns: ['board.col.toStudy', 'board.col.studying', 'board.col.review', 'board.col.mastered'] },
    { id: 'personal', name: t('board.templatePersonal'), columns: ['board.col.ideas', 'board.col.planning', 'board.col.doing', 'board.col.completed'] },
    { id: 'sprint',   name: t('board.templateSprint'),   columns: ['board.col.sprintBacklog', 'board.col.inDevelopment', 'board.col.testing', 'board.col.deployed'] },
    { id: 'blank',    name: t('board.templateBlank'),    columns: [] },
  ]

  const template = TEMPLATES.find((tmpl) => tmpl.id === selectedTemplate)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-overlay-in" onClick={onClose}>
      <div
        className="w-full max-w-md bg-[var(--surface)] rounded-[var(--radius-2xl)] shadow-[var(--shadow-xl)] border border-[var(--sep)] p-6 animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-[var(--label)]">{t('board.new')}</h3>
          <button onClick={onClose} className="p-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--surface-2)] transition-colors">
            <X className="w-4 h-4 text-[var(--label-3)]" />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-[var(--label)] mb-1.5">{t('board.name')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('board.namePlaceholder')}
              autoFocus
              className="w-full px-3 py-2.5 text-sm rounded-[var(--radius-lg)] bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label)] placeholder:text-[var(--label-3)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--label)] mb-2">{t('board.color')}</label>
            <div className="flex gap-2">
              {BOARD_SWATCH_COLORS.map((c, i) => (
                <button
                  key={i}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${color === c ? 'border-[var(--accent)] scale-110' : 'border-[var(--sep)]'} ${!c ? 'bg-[var(--surface-3)]' : ''}`}
                  style={c ? { backgroundColor: c } : undefined}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--label)] mb-2">{t('board.template')}</label>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => setSelectedTemplate(tmpl.id)}
                  className={`px-3 py-2.5 text-sm rounded-[var(--radius-lg)] border transition-colors text-left ${
                    selectedTemplate === tmpl.id
                      ? 'border-[var(--accent)] bg-[var(--accent-f)] text-[var(--accent)]'
                      : 'border-[var(--sep)] text-[var(--label-2)] hover:bg-[var(--surface-2)]'
                  }`}
                >
                  <p className="font-medium">{tmpl.name}</p>
                  <p className="text-[10px] text-[var(--label-3)] mt-0.5">
                    {tmpl.columns.length > 0 ? tmpl.columns.map((k) => t(k)).join(' › ') : t('board.emptyBoard')}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onClose} className="text-[var(--label)]">
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => { if (name.trim() && template) onSave(name.trim(), color, template.columns.map(k => t(k))) }}
              disabled={!name.trim()}
            >
              {t('board.create')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
