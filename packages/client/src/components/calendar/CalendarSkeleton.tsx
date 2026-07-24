import { useTranslation } from 'react-i18next'

// Suspense fallback for the calendar route — mirrors the monthly grid's
// shape (header bar + 7x5 cells) so the route swap doesn't read as a blank
// flash before the real grid pops in. Below md the real page renders the
// agenda list instead, so the skeleton swaps shape to match. Used only for
// the calendar page; other lazy routes keep the generic spinner in App.tsx.
export function CalendarSkeleton() {
  const { t } = useTranslation()
  return (
    <div className="h-full flex flex-col p-3 md:p-6 animate-pulse" role="status" aria-label={t('common.loading')}>
      <div className="flex flex-wrap items-center justify-between gap-y-2 mb-4 md:mb-6">
        <div className="h-6 w-32 md:w-40 rounded-[var(--radius-sm)] bg-[var(--surface-2)]" />
        <div className="h-8 w-full md:w-56 rounded-[var(--radius-full)] bg-[var(--surface-2)]" />
      </div>

      {/* Agenda placeholder — below md only */}
      <div className="flex flex-col gap-4 md:hidden">
        {Array.from({ length: 4 }).map((_, group) => (
          <div key={group}>
            <div className="h-4 w-24 mb-2 rounded-[var(--radius-sm)] bg-[var(--surface-2)]" />
            <div className="rounded-[var(--radius-xl)] border border-[var(--sep)] divide-y divide-[var(--sep)]">
              {Array.from({ length: 2 }).map((_, row) => (
                <div key={row} className="h-14 bg-[var(--surface)]" />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block flex-1 rounded-[var(--radius-xl)] overflow-hidden border border-[var(--sep)]">
        <div className="grid grid-cols-7 border-b border-[var(--sep)] bg-[var(--surface-2)]">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-7 border-r border-[var(--sep)] last:border-r-0" />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, row) => (
          <div key={row} className={`grid grid-cols-7 ${row < 4 ? 'border-b border-[var(--sep)]' : ''}`}>
            {Array.from({ length: 7 }).map((_, col) => (
              <div key={col} className="h-20 border-r border-[var(--sep)] last:border-r-0 bg-[var(--surface)] p-2">
                <div className="w-5 h-5 rounded-full bg-[var(--surface-2)]" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
