// Shape-matching loading skeleton for Notes: list rail on the left, editor
// block on the right.
export function NotesSkeleton() {
  return (
    <div className="h-full flex animate-pulse" role="status" aria-label="Cargando">
      <div className="w-64 shrink-0 border-r border-[var(--sep)] p-4 space-y-2">
        <div className="h-8 w-full rounded-[var(--radius-lg)] bg-[var(--surface-2)] mb-4" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-9 rounded-[var(--radius-md)] bg-[var(--surface-2)]" style={{ width: `${70 + ((i * 13) % 30)}%` }} />
        ))}
      </div>
      <div className="flex-1 p-8">
        <div className="h-8 w-64 rounded-[var(--radius-lg)] bg-[var(--surface-2)] mb-6" />
        <div className="space-y-3 max-w-2xl">
          <div className="h-3.5 w-full rounded-[var(--radius-sm)] bg-[var(--surface-2)]" />
          <div className="h-3.5 w-11/12 rounded-[var(--radius-sm)] bg-[var(--surface-2)]" />
          <div className="h-3.5 w-4/5 rounded-[var(--radius-sm)] bg-[var(--surface-2)]" />
          <div className="h-3.5 w-2/3 rounded-[var(--radius-sm)] bg-[var(--surface-2)]" />
        </div>
      </div>
    </div>
  )
}
