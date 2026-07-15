// Shape-matching loading skeleton for the Today dashboard (same approach as
// CalendarSkeleton): greeting block, then the widget grid.
export function TodaySkeleton() {
  return (
    <div className="h-full p-6 md:p-8 animate-pulse" role="status" aria-label="Cargando">
      <div className="max-w-5xl mx-auto">
        <div className="h-9 w-72 rounded-[var(--radius-lg)] bg-[var(--surface-2)] mb-2" />
        <div className="h-4 w-44 rounded-[var(--radius-sm)] bg-[var(--surface-2)] mb-8" />
        <div className="grid md:grid-cols-2 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-[var(--radius-2xl)] border border-[var(--sep)] bg-[var(--surface)] p-5">
              <div className="h-4 w-28 rounded-[var(--radius-sm)] bg-[var(--surface-2)] mb-4" />
              <div className="space-y-2.5">
                <div className="h-3.5 w-full rounded-[var(--radius-sm)] bg-[var(--surface-2)]" />
                <div className="h-3.5 w-5/6 rounded-[var(--radius-sm)] bg-[var(--surface-2)]" />
                <div className="h-3.5 w-2/3 rounded-[var(--radius-sm)] bg-[var(--surface-2)]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
