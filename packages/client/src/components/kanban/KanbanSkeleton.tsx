import { useTranslation } from 'react-i18next'

// Shape-matching loading skeleton for the Kanban board: header bar plus three
// column rails with a few card blocks each.
export function KanbanSkeleton() {
  const { t } = useTranslation()
  const cards = [3, 2, 2]
  return (
    <div className="h-full p-3 md:p-6 animate-pulse" role="status" aria-label={t('common.loading')}>
      <div className="h-7 w-40 md:w-48 rounded-[var(--radius-lg)] bg-[var(--surface-2)] mb-4 md:mb-6" />
      <div className="flex gap-4">
        {cards.map((count, col) => (
          // Only the first rail is shown below md — the real board pages one
          // column at a time there, so a three-rail skeleton would promise a
          // layout that never arrives.
          <div key={col} className={`w-full md:w-72 shrink-0 ${col > 0 ? 'hidden md:block' : ''}`}>
            <div className="h-4 w-24 rounded-[var(--radius-sm)] bg-[var(--surface-2)] mb-3" />
            <div className="space-y-2.5">
              {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="rounded-[var(--radius-xl)] border border-[var(--sep)] bg-[var(--surface)] p-3.5">
                  <div className="h-3.5 w-5/6 rounded-[var(--radius-sm)] bg-[var(--surface-2)] mb-2.5" />
                  <div className="h-3 w-16 rounded-[var(--radius-sm)] bg-[var(--surface-2)]" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
