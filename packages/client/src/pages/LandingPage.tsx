import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Kanban, StickyNote, Target, CalendarDays, Timer, Moon,
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

    const onMouseMove = (e: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      target.x = (e.clientX - (rect.left + rect.width  / 2)) / (rect.width  / 2)
      target.y = (e.clientY - (rect.top  + rect.height / 2)) / (rect.height / 2)
    }

    const onMouseLeave = () => { target.x = 0; target.y = 0 }

    let cancelled = false
    const tick = () => {
      vel.x = vel.x * 0.82 + (target.x - pos.x) * 0.065
      vel.y = vel.y * 0.82 + (target.y - pos.y) * 0.065
      pos.x += vel.x
      pos.y += vel.y

      if (layer1Ref.current) layer1Ref.current.style.transform = `translate(${pos.x * 6}px, ${pos.y * 4}px)`
      if (layer2Ref.current) layer2Ref.current.style.transform = `translate(${pos.x * 13}px, ${pos.y * 9}px)`
      if (layer3Ref.current) layer3Ref.current.style.transform = `translate(${pos.x * 22}px, ${pos.y * 15}px)`

      if (!cancelled) requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
    window.addEventListener('mousemove', onMouseMove)
    const el = containerRef.current
    el?.addEventListener('mouseleave', onMouseLeave)

    return () => {
      cancelled = true
      window.removeEventListener('mousemove', onMouseMove)
      el?.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  return { containerRef, layer1Ref, layer2Ref, layer3Ref }
}

// ─── App mockup with 3-layer parallax ─────────────────────────────────────────
function AppMockup() {
  const { containerRef, layer1Ref, layer2Ref, layer3Ref } = useCursorParallax()

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-[480px] select-none pointer-events-none"
      style={{ height: '300px' }}
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
          className="w-full h-full rounded-[16px] border border-[var(--sep)] bg-[var(--surface)] shadow-[0_16px_48px_rgba(0,0,0,0.12)] overflow-hidden"
        >
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--sep)]">
            <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
            <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
            <div className="w-3 h-3 rounded-full bg-[#28C840]" />
            <div className="flex-1 mx-4 h-5 rounded-full bg-[var(--surface-2)]" />
          </div>
          <div className="flex gap-3 p-4">
            <div className="w-28 shrink-0 space-y-1.5">
              {['Home', 'Today', 'Board', 'Calendar', 'Notes', 'Habits'].map((item, i) => (
                <div key={item} className={`h-6 rounded-[6px] flex items-center px-2 gap-1.5 ${i === 2 ? 'bg-[var(--accent-f)]' : ''}`}>
                  <div className={`w-2.5 h-2.5 rounded-[3px] ${i === 2 ? 'bg-[var(--accent)]' : 'bg-[var(--surface-3)]'}`} />
                  <div className={`h-2 rounded flex-1 ${i === 2 ? 'bg-[var(--accent)] opacity-60' : 'bg-[var(--surface-3)]'}`} />
                </div>
              ))}
            </div>
            <div className="flex-1 flex gap-2 min-w-0">
              {[
                { label: 'Por hacer',   cards: 3, color: 'bg-[var(--surface-3)]' },
                { label: 'En progreso', cards: 2, color: 'bg-[var(--accent-f)]'  },
                { label: 'Listo',       cards: 1, color: 'bg-[var(--surface-2)]' },
              ].map((col) => (
                <div key={col.label} className="flex-1 space-y-1.5 min-w-0">
                  <div className={`h-5 rounded-[6px] ${col.color}`} />
                  {Array.from({ length: col.cards }).map((_, j) => (
                    <div key={j} className="h-8 rounded-[8px] bg-[var(--surface-2)] border border-[var(--sep)]" />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="px-4 pb-3 pt-1 flex gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-6 rounded-full border ${
                  i < 5
                    ? 'bg-[var(--accent)] border-[var(--accent)] opacity-80'
                    : 'bg-[var(--surface-2)] border-[var(--sep)]'
                }`}
              />
            ))}
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
const leftFeatures = [
  { icon: Kanban,       title: 'Tareas & Kanban',      desc: 'Tableros drag-and-drop con columnas personalizadas, prioridades y etiquetas.' },
  { icon: Target,       title: 'Hábitos diarios',      desc: 'Registra hábitos booleanos o medibles con seguimiento histórico y rachas.' },
  { icon: Timer,        title: 'Pomodoro integrado',   desc: 'Sesiones de trabajo enfocado integradas directamente en tu workspace.' },
]

const rightFeatures = [
  { icon: StickyNote,   title: 'Notas enriquecidas',   desc: 'Editor de texto completo con carpetas, encabezados, listas y bloques de código.' },
  { icon: CalendarDays, title: 'Vista de calendario',  desc: 'Visualiza tus fechas límite en un calendario mensual interactivo.' },
  { icon: Moon,         title: 'Modo oscuro',          desc: 'Tema claro u oscuro que se adapta a tu preferencia y se recuerda.' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────
export function LandingPage() {
  const user         = useAuthStore((s) => s.user)
  const featHeadRef  = useReveal<HTMLHeadingElement>(0.5)
  const featLeftRef  = useStagger<HTMLDivElement>(0.2)
  const featRightRef = useStagger<HTMLDivElement>(0.2)
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
          <div className="grid md:grid-cols-2 gap-x-16">
            <div ref={featLeftRef}>
              {leftFeatures.map(({ icon: Icon, title, desc }, i) => (
                <div
                  key={title}
                  className={`flex gap-4 py-8 ${i > 0 ? 'border-t border-[var(--sep)]' : ''}`}
                >
                  <Icon className="w-5 h-5 text-[var(--accent)] shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--label)] mb-1.5">{title}</h3>
                    <p className="text-sm leading-relaxed text-[var(--label-2)]">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div ref={featRightRef} className="border-t border-[var(--sep)] md:border-t-0 md:pt-14">
              {rightFeatures.map(({ icon: Icon, title, desc }, i) => (
                <div
                  key={title}
                  className={`flex gap-4 py-8 ${i > 0 ? 'border-t border-[var(--sep)]' : ''}`}
                >
                  <Icon className="w-5 h-5 text-[var(--accent)] shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--label)] mb-1.5">{title}</h3>
                    <p className="text-sm leading-relaxed text-[var(--label-2)]">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
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

      {/* ── Beta CTA: blue ────────────────────────────────────── */}
      <section className="bg-[var(--accent)]">
        <div ref={ctaRef} className="max-w-6xl mx-auto px-6 py-16 text-center">
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
