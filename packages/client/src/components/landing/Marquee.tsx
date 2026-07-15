import {
  Kanban, Target, StickyNote, CalendarDays, Timer, Moon, Sparkles, Zap,
} from 'lucide-react'

// Feature-chip marquee strip. The chip list is rendered twice so the CSS
// -50% translate loop is seamless; the second copy is aria-hidden. Pauses on
// hover (see .landing-marquee in index.css) and stops entirely under reduced
// motion — the first copy remains readable as a static row.
const CHIPS = [
  { icon: Kanban,       label: 'Tableros Kanban',    fg: 'var(--mod-tasks)',    bg: 'var(--mod-tasks-f)' },
  { icon: Target,       label: 'Hábitos y rachas',   fg: 'var(--mod-habits)',   bg: 'var(--mod-habits-f)' },
  { icon: StickyNote,   label: 'Notas enriquecidas', fg: 'var(--mod-notes)',    bg: 'var(--mod-notes-f)' },
  { icon: CalendarDays, label: 'Calendario mensual', fg: 'var(--mod-calendar)', bg: 'var(--mod-calendar-f)' },
  { icon: Timer,        label: 'Pomodoro integrado', fg: 'var(--accent)',       bg: 'var(--accent-f)' },
  { icon: Sparkles,     label: 'Asistente IA',       fg: 'var(--accent)',       bg: 'var(--accent-f)' },
  { icon: Moon,         label: 'Modo oscuro',        fg: 'var(--label-2)',      bg: 'var(--surface-2)' },
  { icon: Zap,          label: 'Sincronización en tiempo real', fg: 'var(--sync)', bg: 'var(--sync-f)' },
]

function ChipRow({ hidden }: { hidden?: boolean }) {
  return (
    <div className="flex items-center gap-3 pr-3" aria-hidden={hidden || undefined}>
      {CHIPS.map(({ icon: Icon, label, fg, bg }) => (
        <span
          key={label}
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-[var(--sep)] bg-[var(--surface)] pl-2 pr-3.5 py-1.5 text-[13px] font-medium text-[var(--label-2)]"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: bg }}>
            <Icon className="h-3.5 w-3.5" style={{ color: fg }} strokeWidth={2.25} />
          </span>
          {label}
        </span>
      ))}
    </div>
  )
}

export function Marquee() {
  return (
    <div
      className="relative overflow-hidden py-8 border-b border-[var(--sep)]"
      style={{
        maskImage: 'linear-gradient(90deg, transparent, black 8%, black 92%, transparent)',
        WebkitMaskImage: 'linear-gradient(90deg, transparent, black 8%, black 92%, transparent)',
      }}
    >
      <div className="landing-marquee flex w-max">
        <ChipRow />
        <ChipRow hidden />
      </div>
    </div>
  )
}
