// Shape-matching loading skeleton for Settings: header plus a stack of section cards.
export function SettingsSkeleton() {
  return (
    <div className="h-full overflow-y-auto bg-[var(--bg)] animate-pulse" role="status" aria-label="Cargando">
      <div className="max-w-xl mx-auto px-6 py-8">
        <div className="h-7 w-40 rounded-[var(--radius-lg)] bg-[var(--surface-2)] mb-6" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-[var(--radius-2xl)] border border-[var(--sep)] bg-[var(--surface)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--sep)]">
                <div className="h-4 w-28 rounded-[var(--radius-sm)] bg-[var(--surface-2)]" />
              </div>
              <div className="p-4 space-y-2">
                <div className="h-9 w-full rounded-[var(--radius-lg)] bg-[var(--surface-2)]" />
                <div className="h-9 w-2/3 rounded-[var(--radius-lg)] bg-[var(--surface-2)]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
