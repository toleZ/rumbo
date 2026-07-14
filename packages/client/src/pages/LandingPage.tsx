import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import {
  Kanban, StickyNote, Target, CalendarDays, Timer, Moon, Sun, Rows3, Check,
  ArrowRight, CheckCircle2,
} from 'lucide-react'
import { Navbar } from '../components/landing/Navbar'
import { Footer } from '../components/landing/Footer'
import { WordReveal } from '../components/landing/WordReveal'
import { useAuthStore } from '../stores/authStore'

// ─── Spring cursor parallax ────────────────────────────────────────────────────
function useCursorParallax() {
  const containerRef = useRef<HTMLDivElement>(null)
  const layer1Ref    = useRef<HTMLDivElement>(null)
  const layer2Ref    = useRef<HTMLDivElement>(null)
  const layer3Ref    = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return

    const target = { x: 0, y: 0 }
    const pos    = { x: 0, y: 0 }
    const vel    = { x: 0, y: 0 }

    const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

    // Normalized to the container's own half-width/height, then clamped to
    // [-1, 1] — without the clamp, moving the mouse anywhere on the page
    // (this used to listen on `window`) produced huge multiples once the
    // cursor was more than half a card-width away, snapping the layers far
    // out of alignment instead of a subtle tilt.
    const onMouseMove = (e: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      target.x = clamp((e.clientX - (rect.left + rect.width  / 2)) / (rect.width  / 2), -1, 1)
      target.y = clamp((e.clientY - (rect.top  + rect.height / 2)) / (rect.height / 2), -1, 1)
    }

    const onMouseLeave = () => { target.x = 0; target.y = 0 }

    let cancelled = false
    const tick = () => {
      vel.x = vel.x * 0.82 + (target.x - pos.x) * 0.065
      vel.y = vel.y * 0.82 + (target.y - pos.y) * 0.065
      pos.x += vel.x
      pos.y += vel.y

      if (layer1Ref.current) layer1Ref.current.style.transform = `translate(${pos.x * 3}px, ${pos.y * 2}px)`
      if (layer2Ref.current) layer2Ref.current.style.transform = `translate(${pos.x * 6}px, ${pos.y * 4}px)`
      if (layer3Ref.current) layer3Ref.current.style.transform = `translate(${pos.x * 10}px, ${pos.y * 7}px)`

      if (!cancelled) requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
    // Listens on the section ancestor, not `window` — the mockup itself is
    // pointer-events-none (decorative/aria-hidden), so it can't receive its
    // own mouse events, but scoping to the hero section (rather than the
    // whole page) means scrolling past the hero and moving the mouse
    // elsewhere no longer nudges an off-screen mockup for no reason.
    const section = containerRef.current?.closest('section')
    section?.addEventListener('mousemove', onMouseMove)
    section?.addEventListener('mouseleave', onMouseLeave)

    return () => {
      cancelled = true
      section?.removeEventListener('mousemove', onMouseMove)
      section?.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  return { containerRef, layer1Ref, layer2Ref, layer3Ref }
}

// ─── App mockup with 3-layer parallax + a live mini-demo loop ─────────────────
// Real task titles and real product chrome (not abstract bars) so the hero
// demonstrates Rumbo in ~2 seconds instead of describing it. The demo card
// uses a shared layoutId to "drag" itself between columns, and the done card
// reuses the app's actual .task-title-strike CSS — same motion the real
// product uses when you check off a task.
const MOCK_SIDEBAR = [
  { label: 'Hoy', icon: Sun },
  { label: 'Tablero', icon: Kanban, active: true },
  { label: 'Lista', icon: Rows3 },
  { label: 'Calendario', icon: CalendarDays },
  { label: 'Notas', icon: StickyNote },
  { label: 'Hábitos', icon: Target },
]

function MockTag({ tone, children }: { tone: 'danger' | 'warning' | 'neutral'; children: string }) {
  const cls = tone === 'danger'
    ? 'bg-[rgba(255,59,48,0.12)] text-[var(--danger)]'
    : tone === 'warning'
      ? 'bg-[rgba(255,166,0,0.14)] text-[var(--warning)]'
      : 'bg-[var(--surface-3)] text-[var(--label-3)]'
  return <span className={`inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded-[4px] ${cls}`}>{children}</span>
}

function MockCard({ title, tag, tone }: { title: string; tag: string; tone: 'danger' | 'warning' | 'neutral' }) {
  return (
    <div className="rounded-[10px] bg-[var(--surface)] border border-[var(--sep)] px-2.5 py-2 shadow-[var(--shadow-xs)]">
      <p className="text-[11px] font-medium text-[var(--label)] leading-snug mb-1.5">{title}</p>
      <MockTag tone={tone}>{tag}</MockTag>
    </div>
  )
}

function AppMockup() {
  const { containerRef, layer1Ref, layer2Ref, layer3Ref } = useCursorParallax()
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setStep((s) => (s + 1) % 3), 2600)
    return () => clearInterval(id)
  }, [])

  const cardInProgress = step >= 1
  const taskDone = step === 2
  const streakFilled = 3 + step

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-[480px] select-none pointer-events-none"
      style={{ height: '336px' }}
      aria-hidden="true"
    >
      <div className="absolute inset-0" style={{ transform: 'translate(24px, 24px)' }}>
        <div
          ref={layer1Ref}
          className="w-full h-full opacity-40 rounded-[16px] border border-[var(--sep)] bg-[var(--surface)] shadow-[0_8px_32px_rgba(0,0,0,0.08)]"
        />
      </div>
      <div className="absolute inset-0" style={{ transform: 'translate(12px, 12px)' }}>
        <div
          ref={layer2Ref}
          className="w-full h-full opacity-70 rounded-[16px] border border-[var(--sep)] bg-[var(--surface)] shadow-[0_8px_32px_rgba(0,0,0,0.08)]"
        />
      </div>
      <div className="absolute inset-0">
        <div
          ref={layer3Ref}
          className="w-full h-full rounded-[16px] border border-[var(--sep)] bg-[var(--surface)] shadow-[0_16px_48px_rgba(0,0,0,0.12)] overflow-hidden flex flex-col"
        >
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--sep)] shrink-0">
            <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
            <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
            <div className="w-3 h-3 rounded-full bg-[#28C840]" />
            <div className="flex-1 mx-4 h-5 rounded-full bg-[var(--surface-2)] flex items-center px-2.5">
              <span className="text-[9px] text-[var(--label-3)] truncate">rumbo.app/app</span>
            </div>
          </div>
          <div className="flex gap-3 p-4 flex-1 min-h-0">
            <div className="w-[92px] shrink-0 space-y-1">
              {MOCK_SIDEBAR.map(({ label, icon: Icon, active }) => (
                <div
                  key={label}
                  className={`h-6 rounded-[6px] flex items-center px-1.5 gap-1.5 text-[10px] font-medium ${
                    active ? 'bg-[var(--accent-f)] text-[var(--accent)]' : 'text-[var(--label-3)]'
                  }`}
                >
                  <Icon className="w-3 h-3 shrink-0" strokeWidth={2.25} />
                  <span className="truncate">{label}</span>
                </div>
              ))}
            </div>
            <div className="flex-1 flex gap-2 min-w-0">
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="text-[9px] font-bold uppercase tracking-wide text-[var(--label-3)] px-0.5 mb-1">Por hacer</div>
                <MockCard title="Preparar demo" tag="Baja" tone="neutral" />
                <AnimatePresence>
                  {!cardInProgress && (
                    <motion.div layoutId="hero-demo-card" transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
                      <MockCard title="Revisar copy de la landing" tag="Media" tone="warning" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="text-[9px] font-bold uppercase tracking-wide text-[var(--label-3)] px-0.5 mb-1">En progreso</div>
                <MockCard title="Sincronizar calendario" tag="Alta" tone="danger" />
                <AnimatePresence>
                  {cardInProgress && (
                    <motion.div layoutId="hero-demo-card" transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
                      <MockCard title="Revisar copy de la landing" tag="Media" tone="warning" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="text-[9px] font-bold uppercase tracking-wide text-[var(--label-3)] px-0.5 mb-1">Listo</div>
                <div className="rounded-[10px] bg-[var(--surface)] border border-[var(--sep)] px-2.5 py-2 shadow-[var(--shadow-xs)] flex items-center gap-2">
                  <span className={`w-3.5 h-3.5 rounded-full border shrink-0 flex items-center justify-center transition-colors duration-300 ${
                    taskDone ? 'bg-[var(--success)] border-[var(--success)]' : 'border-[var(--sep)]'
                  }`}>
                    {taskDone && <Check className="w-2.5 h-2.5 text-white animate-check-bounce" strokeWidth={3} />}
                  </span>
                  <span className={`task-title-strike text-[11px] font-medium text-[var(--label)] ${taskDone ? 'is-done' : ''}`}>
                    Definir paleta de colores
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="px-4 pb-3.5 pt-2 border-t border-[var(--sep)] flex items-center gap-2 shrink-0">
            <Target className="w-3 h-3 text-[var(--success)] shrink-0" />
            <div className="flex-1 flex gap-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex-1 h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--success)] transition-transform duration-500 origin-left"
                    style={{
                      transform: i < streakFilled ? 'scaleX(1)' : 'scaleX(0)',
                      transitionDelay: `${i * 50}ms`,
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Scroll reveal hooks ──────────────────────────────────────────────────────
function useReveal<T extends HTMLElement = HTMLDivElement>(threshold = 0.2) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.classList.add('landing-reveal-init')
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('landing-reveal-in')
          io.disconnect()
        }
      },
      { threshold }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return ref
}

function useStagger<T extends HTMLElement = HTMLDivElement>(threshold = 0.15) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.classList.add('landing-stagger-init')
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('landing-stagger-in')
          io.disconnect()
        }
      },
      { threshold }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return ref
}

// ─── Feature data ──────────────────────────────────────────────────────────────
// The 4 primary features get their own module color (same hues the real app
// uses for boards/habits/notes/calendar — coherence for free), so each card
// reads as a distinct little showcase instead of a uniform list. Pomodoro and
// dark mode are real but secondary, so they get a lighter, smaller treatment
// rather than equal visual weight — 6 equally-loud items dilutes the pitch.
const primaryFeatures = [
  {
    icon: Kanban, title: 'Tareas & Kanban',
    desc: 'Tableros drag-and-drop con columnas personalizadas, prioridades y etiquetas.',
    bg: 'var(--mod-tasks-f)', fg: 'var(--mod-tasks)',
  },
  {
    icon: Target, title: 'Hábitos diarios',
    desc: 'Registra hábitos booleanos o medibles con seguimiento histórico y rachas.',
    bg: 'var(--mod-habits-f)', fg: 'var(--mod-habits)',
  },
  {
    icon: StickyNote, title: 'Notas enriquecidas',
    desc: 'Editor de texto completo con carpetas, encabezados, listas y bloques de código.',
    bg: 'var(--mod-notes-f)', fg: 'var(--mod-notes)',
  },
  {
    icon: CalendarDays, title: 'Vista de calendario',
    desc: 'Visualiza tus fechas límite en un calendario mensual interactivo.',
    bg: 'var(--mod-calendar-f)', fg: 'var(--mod-calendar)',
  },
]

const secondaryFeatures = [
  { icon: Timer, title: 'Pomodoro integrado', desc: 'Sesiones de trabajo enfocado integradas en tu workspace.' },
  { icon: Moon,  title: 'Modo oscuro',        desc: 'Se adapta a tu preferencia y se recuerda.' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────
export function LandingPage() {
  const user         = useAuthStore((s) => s.user)
  const featHeadRef  = useReveal<HTMLHeadingElement>(0.5)
  const featGridRef  = useStagger<HTMLDivElement>(0.15)
  const featSecRef   = useReveal<HTMLDivElement>(0.3)
  const whyRef       = useReveal<HTMLDivElement>(0.2)
  const ctaRef       = useReveal<HTMLDivElement>(0.4)

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Navbar />

      {/* ── Hero: blue/light split ────────────────────────────── */}
      <section className="overflow-hidden">
        <div className="grid md:grid-cols-2">

          {/* Left column — drenched blue */}
          <div className="relative bg-[var(--accent)] flex items-center justify-center md:justify-end">
            {/* Radial glow depth layer */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse 80% 60% at 25% 40%, rgba(255,255,255,0.10) 0%, transparent 65%)' }}
            />
            {/* Compass watermark — echoes the logo mark on the brand surface itself */}
            <svg
              className="absolute -right-16 -bottom-16 w-[420px] h-[420px] pointer-events-none opacity-[0.07]"
              viewBox="0 0 28 28"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="14" cy="14" r="13" stroke="white" strokeWidth="1" fill="none" />
              <circle cx="14" cy="14" r="2" fill="white" />
              <line x1="14" y1="4" x2="14" y2="8" stroke="white" strokeWidth="1" strokeLinecap="round" />
              <line x1="14" y1="20" x2="14" y2="24" stroke="white" strokeWidth="0.75" strokeLinecap="round" />
              <line x1="4" y1="14" x2="8" y2="14" stroke="white" strokeWidth="0.75" strokeLinecap="round" />
              <line x1="20" y1="14" x2="24" y2="14" stroke="white" strokeWidth="0.75" strokeLinecap="round" />
              <polygon points="14,7 16.5,13 14,12 11.5,13" fill="white" />
            </svg>
            <div className="relative w-full max-w-[576px] px-6 md:pl-6 md:pr-14 pt-32 pb-16 md:pt-44 md:pb-36">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-white bg-white/[0.15] px-3 py-1.5 rounded-full mb-6 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                Beta abierta — Plazas limitadas
              </div>
              <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight leading-[1.15] mb-5">
                <WordReveal className="text-white/85" delay={80}>Tu espacio de trabajo,</WordReveal>
                <br />
                <WordReveal className="text-white font-extrabold" delay={320}>sin ruido.</WordReveal>
              </h1>
              <p className="text-[17px] text-white/70 leading-relaxed mb-8 max-w-md">
                Tareas, notas, hábitos y calendario en un solo lugar.
                Diseñado para personas que quieren hacer más, no configurar más.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/beta"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[var(--accent)] font-semibold rounded-[10px] hover:bg-white/90 active:scale-[0.97] transition-[transform,background-color] duration-[160ms] text-sm shadow-[0_2px_12px_rgba(0,0,0,0.15)]"
                >
                  Solicitar acceso
                  <ArrowRight className="w-4 h-4" />
                </Link>
                {user ? (
                  <Link
                    to="/app"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white/[0.12] text-white font-semibold rounded-[10px] border border-white/[0.22] hover:bg-white/[0.20] active:scale-[0.97] transition-[transform,background-color] duration-[160ms] text-sm"
                  >
                    Abrir app →
                  </Link>
                ) : (
                  <a
                    href="#features"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white/[0.12] text-white font-semibold rounded-[10px] border border-white/[0.22] hover:bg-white/[0.20] active:scale-[0.97] transition-[transform,background-color] duration-[160ms] text-sm"
                  >
                    Ver funciones ↓
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Right column — light, parallax mockup */}
          <div className="hidden md:flex bg-[var(--bg)] items-center justify-start">
            <div className="w-full max-w-[576px] px-6 md:pr-6 md:pl-14 pt-44 pb-36">
              <AppMockup />
            </div>
          </div>

        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section id="features" className="scroll-mt-20 py-24 md:py-32 bg-[var(--bg-2)]">
        <div className="max-w-6xl mx-auto px-6">
          <h2 ref={featHeadRef} className="font-display text-3xl md:text-4xl font-semibold text-[var(--label)] tracking-tight mb-16">
            Todo lo que necesitas.
          </h2>

          <div ref={featGridRef} className="grid sm:grid-cols-2 gap-5">
            {primaryFeatures.map(({ icon: Icon, title, desc, bg, fg }) => (
              <div
                key={title}
                className="group rounded-[var(--radius-2xl)] border border-[var(--sep)] bg-[var(--surface)] p-6 md:p-7 transition-[transform,box-shadow] duration-300 ease-[var(--ease-out-expo)] hover:-translate-y-1 hover:shadow-[var(--shadow-lg)]"
              >
                <div
                  className="w-11 h-11 rounded-[var(--radius-lg)] flex items-center justify-center mb-5 transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:scale-110"
                  style={{ background: bg }}
                >
                  <Icon className="w-5 h-5" style={{ color: fg }} strokeWidth={2} />
                </div>
                <h3 className="text-base font-semibold text-[var(--label)] mb-2">{title}</h3>
                <p className="text-sm leading-relaxed text-[var(--label-2)]">{desc}</p>
              </div>
            ))}
          </div>

          <div ref={featSecRef} className="mt-14 pt-10 border-t border-[var(--sep)] flex flex-wrap justify-center gap-x-12 gap-y-5">
            {secondaryFeatures.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-2.5 max-w-xs">
                <Icon className="w-4 h-4 text-[var(--label-3)] shrink-0 mt-0.5" />
                <p className="text-sm text-[var(--label-2)]">
                  <span className="font-medium text-[var(--label)]">{title}</span> — {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why Rumbo: light ──────────────────────────────────── */}
      <section className="py-24 md:py-32 border-t border-[var(--sep)]">
        <div className="max-w-6xl mx-auto px-6">
          <div ref={whyRef} className="max-w-2xl">
            <h2 className="text-2xl md:text-3xl font-bold text-[var(--label)] tracking-tight mb-5">
              Deja de rebotar entre apps.
            </h2>
            <p className="text-[var(--label-2)] leading-relaxed mb-6">
              Tienes Notion para notas, Trello para tareas, Habitica para hábitos y Google Calendar
              para fechas. Rumbo los reúne en un workspace coherente, sin perder potencia.
            </p>
            <ul className="space-y-3">
              {[
                'Contexto completo de tu día en una sola pantalla',
                'Sin plantillas vacías ni setup infinito',
                'Sincronización en tiempo real entre vistas',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-[var(--label-2)]">
                  <CheckCircle2 className="w-4 h-4 text-[var(--success)] mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Beta CTA: violet→sky gradient, distinct from the hero's flat violet ── */}
      <section className="relative overflow-hidden" style={{ background: 'var(--mod-ai-gradient)' }}>
        {/* Dot-grid texture — a different motif from the hero's compass watermark,
            so the two violet moments in the page don't read as the same component. */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.12]"
          style={{
            backgroundImage: 'radial-gradient(white 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 70% 60% at 80% 0%, rgba(255,255,255,0.16) 0%, transparent 60%)' }}
        />
        <div ref={ctaRef} className="relative max-w-6xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight mb-4">
            Sé de los primeros en probarlo.
          </h2>
          <p className="mb-8 max-w-sm mx-auto text-white/75">
            Las plazas de la beta son limitadas. Solicita acceso gratuito hoy.
          </p>
          <Link
            to="/beta"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[var(--accent)] font-semibold rounded-[10px] hover:bg-white/90 active:scale-[0.97] transition-[transform,background-color] duration-[160ms] text-sm shadow-[0_2px_12px_rgba(0,0,0,0.15)]"
          >
            Solicita acceso gratuito
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}
