import { Link } from 'react-router-dom'
import { Lightbulb, Layers, Rocket } from 'lucide-react'
import { Navbar } from '../components/landing/Navbar'
import { Footer } from '../components/landing/Footer'
import { WordReveal } from '../components/landing/WordReveal'

const steps = [
  { icon: Lightbulb, title: 'Captura',  desc: 'Crea tareas, notas e ideas en segundos. Sin fricciones, sin categorías obligatorias.' },
  { icon: Layers,    title: 'Organiza', desc: 'Agrupa en tableros, carpetas y hábitos. El sistema se adapta a cómo piensas tú.' },
  { icon: Rocket,    title: 'Avanza',   desc: 'Revisa tu día en la vista Today, mide tu progreso y mantén el ritmo con el Pomodoro.' },
]

export function AboutPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Navbar />

      {/* ── Hero: full-width blue ─────────────────────────────── */}
      <section className="relative bg-[var(--accent)] overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 60%, rgba(255,255,255,0.09) 0%, transparent 70%)' }}
        />
        <div className="relative max-w-3xl mx-auto px-6 pt-36 pb-20 md:pt-44 md:pb-24 text-center">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight mb-5">
            <WordReveal className="text-white/85" delay={80}>Construido para quienes</WordReveal>
            <br />
            <WordReveal className="text-white font-extrabold" delay={320}>piensan en movimiento.</WordReveal>
          </h1>
          <p className="text-lg leading-relaxed max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,0.70)' }}>
            Rumbo nació de una frustración: demasiadas herramientas para hacer una sola cosa —
            trabajar con claridad.
          </p>
        </div>
      </section>

      {/* ── Por qué Rumbo ────────────────────────────────────── */}
      <section className="py-16 border-t border-[var(--sep)]">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-xl font-bold text-[var(--label)] tracking-tight mb-5">Por qué Rumbo</h2>
          <div className="space-y-4 text-[var(--label-2)] leading-relaxed text-[15px]">
            <p>
              Las personas productivas no necesitan más funciones — necesitan menos fricción.
              Cada vez que cambias de app, pierdes contexto. Cada vez que configuras una plantilla,
              pierdes tiempo.
            </p>
            <p>
              Rumbo integra las herramientas que ya usas — tareas, notas, hábitos, calendario,
              Pomodoro — en un workspace que se siente coherente desde el primer día.
              Sin setup. Sin curva de aprendizaje.
            </p>
            <p>
              El nombre viene del concepto de rumbo náutico: la dirección que tomas cuando tienes
              claridad sobre dónde vas. Eso es lo que queremos darte.
            </p>
          </div>
        </div>
      </section>

      {/* ── Cómo funciona ────────────────────────────────────── */}
      <section className="py-16 bg-[var(--bg-2)] border-t border-[var(--sep)]">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-xl font-bold text-[var(--label)] tracking-tight mb-12">Cómo funciona</h2>
          <div className="grid md:grid-cols-3 gap-x-12 gap-y-10">
            {steps.map(({ icon: Icon, title, desc }) => (
              <div key={title}>
                <Icon className="w-5 h-5 text-[var(--accent)] mb-4" />
                <h3 className="text-sm font-semibold text-[var(--label)] mb-2">{title}</h3>
                <p className="text-sm text-[var(--label-2)] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Founder ──────────────────────────────────────────── */}
      <section className="py-16 border-t border-[var(--sep)]">
        <div className="max-w-2xl mx-auto px-6">
          <p className="text-[var(--label-2)] leading-relaxed mb-8 text-[15px] italic">
            "Soy desarrollador y llevo años buscando la herramienta perfecta para organizar mi trabajo.
            Siempre terminé usando cuatro apps a la vez. Rumbo es lo que quería que existiera —
            así que lo construí."
          </p>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-sm font-bold shrink-0">
              J
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--label)]">Juan Cruz</p>
              <p className="text-xs text-[var(--label-3)]">Fundador, Rumbo</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="py-16 bg-[var(--bg-2)] border-t border-[var(--sep)] text-center">
        <div className="max-w-xl mx-auto px-6">
          <h2 className="text-xl font-bold text-[var(--label)] mb-3">¿Listo para probarlo?</h2>
          <p className="text-[var(--label-2)] mb-6 text-sm">Solicita acceso a la beta. Es gratis.</p>
          <Link
            to="/beta"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--accent)] text-white font-semibold rounded-[10px] hover:bg-[var(--accent-h)] active:scale-[0.97] transition-[transform,background-color] duration-[160ms] text-sm"
          >
            Solicitar acceso
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}
