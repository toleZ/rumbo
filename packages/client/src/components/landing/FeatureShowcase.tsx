import { useEffect, useRef, useState } from 'react'
import {
  motion, useScroll, useTransform, useMotionValueEvent, useReducedMotion,
  type MotionValue,
} from 'motion/react'
import { Kanban, Target, CalendarDays, Flame, Check } from 'lucide-react'
import { useStagger } from '../../hooks/useReveal'

// Sticky scroll-driven product story: a 280vh section whose pinned viewport
// walks through three module mocks (tasks → habits → calendar) as the user
// scrolls. Below md, or under reduced motion, it renders as a plain stacked
// list — no pinning, no scroll hijack.

// ── Mock panels (decorative, aria-hidden by the parent) ──────────────────────
function PanelChrome({ tint, fg, icon: Icon, label, children }: {
  tint: string
  fg: string
  icon: typeof Kanban
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="w-full max-w-[440px] rounded-[var(--radius-2xl)] border border-[var(--sep)] bg-[var(--surface)] shadow-[var(--shadow-xl)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--sep)]">
        <span className="flex h-6 w-6 items-center justify-center rounded-[6px]" style={{ background: tint }}>
          <Icon className="h-3.5 w-3.5" style={{ color: fg }} strokeWidth={2.25} />
        </span>
        <span className="text-xs font-semibold text-[var(--label-2)]">{label}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function MockKanbanPanel() {
  return (
    <PanelChrome tint="var(--mod-tasks-f)" fg="var(--mod-tasks)" icon={Kanban} label="Tablero · Proyecto web">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--label-3)]">En progreso</p>
          {['Diseñar el hero', 'Escribir el copy'].map((t, i) => (
            <div key={t} className={`rounded-[10px] border bg-[var(--surface)] px-3 py-2.5 shadow-[var(--shadow-xs)] ${i === 0 ? 'border-[var(--accent)] ring-1 ring-[var(--accent-f)]' : 'border-[var(--sep)]'}`}>
              <p className="text-xs font-medium text-[var(--label)]">{t}</p>
              <span className="mt-1.5 inline-block rounded-[4px] bg-[var(--accent-f)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--accent-h)]">Media</span>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--label-3)]">Listo</p>
          {['Definir paleta', 'Elegir tipografía'].map((t) => (
            <div key={t} className="rounded-[10px] border border-[var(--sep)] bg-[var(--surface)] px-3 py-2.5 shadow-[var(--shadow-xs)] opacity-70">
              <p className="text-xs font-medium text-[var(--label)] flex items-center gap-1.5">
                <Check className="h-3 w-3 text-[var(--success)] shrink-0" strokeWidth={3} />
                {t}
              </p>
            </div>
          ))}
        </div>
      </div>
    </PanelChrome>
  )
}

function MockHabitsPanel() {
  const rows = [
    { name: 'Leer 20 min', filled: 6, streak: 21 },
    { name: 'Ejercicio', filled: 5, streak: 12 },
    { name: 'Meditar', filled: 7, streak: 34 },
  ]
  return (
    <PanelChrome tint="var(--mod-habits-f)" fg="var(--mod-habits)" icon={Target} label="Hábitos · Esta semana">
      <div className="space-y-3">
        {rows.map(({ name, filled, streak }) => (
          <div key={name} className="flex items-center gap-3">
            <p className="w-24 shrink-0 text-xs font-medium text-[var(--label)]">{name}</p>
            <div className="flex flex-1 gap-1.5">
              {Array.from({ length: 7 }).map((_, i) => (
                <span
                  key={i}
                  className="h-4 flex-1 rounded-[4px]"
                  style={{ background: i < filled ? 'var(--mod-habits)' : 'var(--surface-2)', opacity: i < filled ? 0.85 : 1 }}
                />
              ))}
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--mod-habits-f)] px-2 py-0.5 text-[10px] font-bold text-[var(--mod-habits)]">
              <Flame className="h-3 w-3" /> {streak}
            </span>
          </div>
        ))}
      </div>
    </PanelChrome>
  )
}

function MockCalendarPanel() {
  const dots: Record<number, string> = { 3: 'var(--mod-tasks)', 8: 'var(--mod-calendar)', 12: 'var(--mod-notes)', 17: 'var(--mod-tasks)', 24: 'var(--mod-calendar)' }
  return (
    <PanelChrome tint="var(--mod-calendar-f)" fg="var(--mod-calendar)" icon={CalendarDays} label="Calendario · Este mes">
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 28 }).map((_, i) => (
          <div
            key={i}
            className={`flex aspect-square flex-col items-center justify-center rounded-[6px] text-[10px] font-medium ${
              i === 15 ? 'bg-[var(--mod-calendar)] text-white' : 'bg-[var(--surface-2)] text-[var(--label-3)]'
            }`}
          >
            {i + 1}
            {dots[i] && i !== 15 && <span className="mt-0.5 h-1 w-1 rounded-full" style={{ background: dots[i] }} />}
          </div>
        ))}
      </div>
    </PanelChrome>
  )
}

// ── Segments ─────────────────────────────────────────────────────────────────
const SEGMENTS = [
  {
    title: 'Tableros que fluyen',
    desc: 'Arrastra tareas entre columnas, asigna prioridades y etiquetas. El tablero se mantiene al día contigo, no al revés.',
    color: 'var(--mod-tasks)',
    Mock: MockKanbanPanel,
  },
  {
    title: 'Rachas que motivan',
    desc: 'Registra hábitos diarios o medibles y observa cómo crecen tus rachas, semana a semana.',
    color: 'var(--mod-habits)',
    Mock: MockHabitsPanel,
  },
  {
    title: 'Tu mes, de un vistazo',
    desc: 'Cada fecha límite aparece en el calendario automáticamente. Nada que duplicar, nada que olvidar.',
    color: 'var(--mod-calendar)',
    Mock: MockCalendarPanel,
  },
]

function Panel({ progress, index, children }: { progress: MotionValue<number>; index: number; children: React.ReactNode }) {
  const ranges: [number[], number[]][] = [
    [[0, 0.23, 0.33], [1, 1, 0]],
    [[0.23, 0.33, 0.57, 0.67], [0, 1, 1, 0]],
    [[0.57, 0.67, 1], [0, 1, 1]],
  ]
  const [input, output] = ranges[index]
  const opacity = useTransform(progress, input, output)
  const y = useTransform(progress, [index / 3, (index + 1) / 3], [24, -24])
  return (
    <motion.div style={{ opacity, y }} className="absolute inset-0 flex items-center justify-center">
      {children}
    </motion.div>
  )
}

function StackedFallback() {
  const ref = useStagger<HTMLDivElement>(0.1)
  return (
    <section className="py-20 bg-[var(--bg)] border-t border-[var(--sep)]">
      <div ref={ref} className="mx-auto max-w-2xl space-y-14 px-6">
        {SEGMENTS.map(({ title, desc, color, Mock }) => (
          <div key={title}>
            <h3 className="mb-2 font-display text-xl font-semibold tracking-tight text-[var(--label)]">
              <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-baseline" style={{ background: color }} />
              {title}
            </h3>
            <p className="mb-5 text-sm leading-relaxed text-[var(--label-2)]">{desc}</p>
            <div aria-hidden="true"><Mock /></div>
          </div>
        ))}
      </div>
    </section>
  )
}

export function FeatureShowcase() {
  const wrapperRef = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  )
  const [seg, setSeg] = useState(0)

  const { scrollYProgress } = useScroll({ target: wrapperRef, offset: ['start start', 'end end'] })
  useMotionValueEvent(scrollYProgress, 'change', (v) => setSeg(Math.min(2, Math.max(0, Math.floor(v * 3)))))

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const onChange = () => setIsDesktop(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  if (reduced || !isDesktop) return <StackedFallback />

  return (
    // 160vh: enough travel for the 3-step story to read, short enough that
    // reaching the next section doesn't feel like scroll labor.
    <section ref={wrapperRef} className="relative bg-[var(--bg)] border-t border-[var(--sep)]" style={{ height: '160vh' }}>
      <div className="sticky top-0 flex h-screen items-center">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-[1fr_2px_1.2fr] items-center gap-12 px-6">

          {/* Left: narrative items */}
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[var(--accent-h)]">Así se siente</p>
            <h2 className="mb-10 font-display text-3xl font-semibold tracking-tight text-[var(--label)]">
              Un espacio, tres ritmos.
            </h2>
            <div className="space-y-8">
              {SEGMENTS.map(({ title, desc, color }, i) => (
                <div
                  key={title}
                  className="transition-[opacity,transform] duration-300 ease-[var(--ease-out)]"
                  style={{ opacity: seg === i ? 1 : 0.35, transform: seg === i ? 'translateX(4px)' : 'none' }}
                >
                  <h3 className="mb-1.5 text-lg font-semibold text-[var(--label)]">
                    <span className="mr-2.5 inline-block h-2.5 w-2.5 rounded-full align-baseline" style={{ background: color }} />
                    {title}
                  </h3>
                  <p className="text-sm leading-relaxed text-[var(--label-2)]">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Middle: progress rail */}
          <div className="relative h-64 w-[2px] self-center overflow-hidden rounded-full bg-[var(--surface-3)]">
            <motion.div
              className="absolute inset-x-0 top-0 origin-top rounded-full bg-[var(--accent)]"
              style={{ scaleY: scrollYProgress, height: '100%' }}
            />
          </div>

          {/* Right: crossfading mock panels */}
          <div className="relative h-[400px]" aria-hidden="true">
            {SEGMENTS.map(({ title, Mock }, i) => (
              <Panel key={title} progress={scrollYProgress} index={i}>
                <Mock />
              </Panel>
            ))}
          </div>

        </div>
      </div>
    </section>
  )
}
