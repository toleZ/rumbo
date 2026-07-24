import { useTranslation } from 'react-i18next'

// Shape-matching loading skeleton for the List view: header, wrapping filter
// row, then the rows container — a table from md up, stacked cards below it,
// which is why the row blocks are taller on narrow screens.
export function ListSkeleton() {
  const { t } = useTranslation()
  return (
    <div className="h-full animate-pulse" role="status" aria-label={t('common.loading')}>
      <div className="flex items-center justify-between gap-3 px-4 md:px-6 h-16 border-b border-[var(--sep)]">
        <div className="h-6 w-28 rounded-[var(--radius-lg)] bg-[var(--surface-2)]" />
        <div className="h-9 w-32 rounded-[var(--radius-md)] bg-[var(--surface-2)]" />
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-6">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="h-9 flex-1 min-w-[180px] max-w-xs rounded-[var(--radius-md)] bg-[var(--surface-2)]" />
          <div className="h-9 w-28 rounded-[var(--radius-md)] bg-[var(--surface-2)]" />
          <div className="h-9 w-24 rounded-[var(--radius-md)] bg-[var(--surface-2)]" />
          <div className="h-9 w-40 rounded-[var(--radius-md)] bg-[var(--surface-2)]" />
        </div>

        <div className="rounded-[var(--radius-xl)] border border-[var(--sep)] bg-[var(--surface)] overflow-hidden divide-y divide-[var(--sep)]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-4 py-3 space-y-2">
              <div className="h-3.5 rounded-[var(--radius-sm)] bg-[var(--surface-2)]" style={{ width: `${45 + ((i * 17) % 40)}%` }} />
              <div className="h-3 w-1/3 rounded-[var(--radius-sm)] bg-[var(--surface-2)] md:hidden" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
