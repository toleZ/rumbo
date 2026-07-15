// Shape-matching loading skeleton for Habits: header plus habit rows, each
// with a 7-dot week strip.
export function HabitsSkeleton() {
  return (
    <div className="h-full p-6 md:p-8 animate-pulse" role="status" aria-label="Cargando">
      <div className="max-w-3xl mx-auto">
        <div className="h-7 w-40 rounded-[var(--radius-lg)] bg-[var(--surface-2)] mb-6" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-[var(--radius-2xl)] border border-[var(--sep)] bg-[var(--surface)] p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="h-4 w-36 rounded-[var(--radius-sm)] bg-[var(--surface-2)]" />
                <div className="h-5 w-12 rounded-full bg-[var(--surface-2)]" />
              </div>
              <div className="flex gap-2">
                {Array.from({ length: 7 }).map((_, d) => (
                  <div key={d} className="h-8 flex-1 rounded-[var(--radius-md)] bg-[var(--surface-2)]" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
