// Suspense fallback for the calendar route — mirrors the monthly grid's
// shape (header bar + 7x5 cells) so the route swap doesn't read as a blank
// flash before the real grid pops in. Used only for the calendar page; other
// lazy routes keep the generic spinner in App.tsx.
export function CalendarSkeleton() {
  return (
    <div className="h-full flex flex-col p-6 animate-pulse">
      <div className="flex items-center justify-between mb-6">
        <div className="h-6 w-40 rounded-[var(--radius-sm)] bg-[var(--surface-2)]" />
        <div className="h-8 w-56 rounded-[var(--radius-full)] bg-[var(--surface-2)]" />
      </div>
      <div className="flex-1 rounded-[var(--radius-xl)] overflow-hidden border border-[var(--sep)]">
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
