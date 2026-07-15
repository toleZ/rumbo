// Shape-matching loading skeleton for the List view: header plus a column of
// task rows.
export function ListSkeleton() {
  return (
    <div className="h-full p-6 md:p-8 animate-pulse" role="status" aria-label="Cargando">
      <div className="max-w-3xl mx-auto">
        <div className="h-7 w-40 rounded-[var(--radius-lg)] bg-[var(--surface-2)] mb-6" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--sep)] bg-[var(--surface)] px-4 py-3">
              <div className="h-4 w-4 rounded-[var(--radius-xs)] bg-[var(--surface-2)] shrink-0" />
              <div className="h-3.5 rounded-[var(--radius-sm)] bg-[var(--surface-2)]" style={{ width: `${45 + ((i * 17) % 40)}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
