import { useState } from 'react'
import { CheckCircle2, Sparkles } from 'lucide-react'
import { Navbar } from '../components/landing/Navbar'
import { Footer } from '../components/landing/Footer'
import { WordReveal } from '../components/landing/WordReveal'
import { trpc } from '../lib/trpc'
import toast from 'react-hot-toast'

const perks = [
  'Acceso anticipado a todas las funciones',
  'Influye en el roadmap del producto',
  'Plan gratuito mientras dure la beta',
  'Soporte directo del fundador',
]

export function BetaPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const apply = trpc.beta.applyBeta.useMutation({
    onSuccess: () => { setSubmitted(true) },
    onError: (err) => { toast.error(err.message) },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    apply.mutate({ name, email, message: message || undefined })
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <Navbar />

      <section className="flex-1 pt-32 pb-24 md:pt-40">
        <div className="max-w-5xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-start">
          {/* Left — pitch */}
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--accent)] bg-[var(--accent-f)] px-3 py-1.5 rounded-full mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              Beta abierta · Plazas limitadas
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-semibold text-[var(--label)] tracking-tight mb-4">
              <WordReveal delay={80}>Únete a la beta de Rumbo.</WordReveal>
            </h1>
            <p className="text-[var(--label-2)] leading-relaxed mb-8">
              Sé parte del grupo inicial que da forma a Rumbo. Acceso completo,
              sin coste durante la beta.
            </p>
            <ul className="space-y-3">
              {perks.map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-sm text-[var(--label-2)]">
                  <CheckCircle2 className="w-4 h-4 text-[var(--success)] mt-0.5 shrink-0" />
                  {p}
                </li>
              ))}
            </ul>
          </div>

          {/* Right — form */}
          <div className="bg-[var(--surface)] border border-[var(--sep)] rounded-[16px] p-8 shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
            {submitted ? (
              <div className="text-center py-10">
                <div className="w-14 h-14 rounded-full bg-[var(--success)]/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-[var(--success)]" />
                </div>
                <h3 className="text-lg font-bold text-[var(--label)] mb-2">¡Solicitud enviada!</h3>
                <p className="text-sm text-[var(--label-2)] max-w-xs mx-auto">
                  Hemos recibido tu solicitud. Te contactaremos en los próximos días con los siguientes pasos.
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-base font-bold text-[var(--label)] mb-5">Solicitar acceso</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--label)] mb-1.5">
                      Nombre completo <span className="text-[var(--danger)]">*</span>
                    </label>
                    <input
                      type="text" value={name} onChange={(e) => setName(e.target.value)} required
                      placeholder="Tu nombre"
                      className="w-full px-4 py-2.5 rounded-[10px] bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label)] placeholder:text-[var(--label-3)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--label)] mb-1.5">
                      Correo electrónico <span className="text-[var(--danger)]">*</span>
                    </label>
                    <input
                      type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                      placeholder="tu@correo.com"
                      className="w-full px-4 py-2.5 rounded-[10px] bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label)] placeholder:text-[var(--label-3)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--label)] mb-1.5">
                      ¿Por qué quieres acceso?
                      <span className="text-[var(--label-3)] font-normal ml-1">(opcional)</span>
                    </label>
                    <textarea
                      value={message} onChange={(e) => setMessage(e.target.value)}
                      rows={3} maxLength={500}
                      placeholder="Cuéntanos un poco sobre cómo planeas usarlo..."
                      className="w-full px-4 py-2.5 rounded-[10px] bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label)] placeholder:text-[var(--label-3)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm resize-none"
                    />
                    <p className="text-right text-xs text-[var(--label-3)] mt-1">{message.length}/500</p>
                  </div>
                  <button
                    type="submit" disabled={apply.isPending}
                    className="w-full py-3 bg-[var(--accent)] text-white font-semibold rounded-[10px] hover:bg-[var(--accent-h)] active:scale-[0.98] disabled:opacity-50 transition-[transform,background-color] duration-[160ms] text-sm"
                  >
                    {apply.isPending ? 'Enviando...' : 'Solicitar acceso gratuito'}
                  </button>
                  <p className="text-center text-xs text-[var(--label-3)]">
                    Sin compromiso. Sin tarjeta de crédito.
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
