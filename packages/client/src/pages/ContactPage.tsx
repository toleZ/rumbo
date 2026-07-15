import { useState } from 'react'
import { Mail, MessageCircle, CheckCircle2 } from 'lucide-react'
import { Navbar } from '../components/landing/Navbar'
import { Footer } from '../components/landing/Footer'
import { WordReveal } from '../components/landing/WordReveal'
import { useReveal, useStagger } from '../hooks/useReveal'
import { trpc } from '../lib/trpc'
import toast from 'react-hot-toast'

export function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const infoRef = useStagger<HTMLDivElement>(0.2)
  const formRef = useReveal<HTMLDivElement>(0.2)

  const contact = trpc.beta.contact.useMutation({
    onSuccess: () => { setSent(true) },
    onError: (err) => { toast.error(err.message) },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    contact.mutate({ name, email, message })
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      <Navbar />

      <section className="flex-1 pt-32 pb-24 md:pt-40">
        <div className="max-w-5xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-start">
          {/* Left — info */}
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-semibold text-[var(--label)] tracking-tight mb-4">
              <WordReveal delay={80}>Hablemos.</WordReveal>
            </h1>
            <p className="text-[var(--label-2)] leading-relaxed mb-8">
              ¿Tienes preguntas sobre la beta, feedback o simplemente quieres saludar?
              Escríbenos, respondemos a todos los mensajes.
            </p>
            <div ref={infoRef} className="space-y-4">
              <div className="flex items-center gap-3 text-sm text-[var(--label-2)]">
                <div className="w-9 h-9 rounded-[9px] bg-[var(--accent-f)] flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-[var(--accent)]" />
                </div>
                <span>toloyjc@gmail.com</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-[var(--label-2)]">
                <div className="w-9 h-9 rounded-[9px] bg-[var(--accent-f)] flex items-center justify-center shrink-0">
                  <MessageCircle className="w-4 h-4 text-[var(--accent)]" />
                </div>
                <span>Respondemos en menos de 24 h</span>
              </div>
            </div>
          </div>

          {/* Right — form */}
          <div ref={formRef} className="bg-[var(--surface)] border border-[var(--sep)] rounded-[16px] p-8 shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
            {sent ? (
              <div className="text-center py-8 animate-modal-in">
                <CheckCircle2 className="w-12 h-12 text-[var(--success)] mx-auto mb-4 animate-check-pop" />
                <h3 className="text-base font-semibold text-[var(--label)] mb-2">Mensaje enviado</h3>
                <p className="text-sm text-[var(--label-2)]">Gracias por escribirnos. Te responderemos pronto.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="group">
                  <label className="block text-sm font-medium text-[var(--label)] mb-1.5 transition-colors duration-[160ms] group-focus-within:text-[var(--accent-h)]">Nombre</label>
                  <input
                    type="text" value={name} onChange={(e) => setName(e.target.value)} required
                    placeholder="Tu nombre"
                    className="w-full px-4 py-2.5 rounded-[10px] bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label)] placeholder:text-[var(--label-3)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-shadow duration-[160ms] text-sm"
                  />
                </div>
                <div className="group">
                  <label className="block text-sm font-medium text-[var(--label)] mb-1.5 transition-colors duration-[160ms] group-focus-within:text-[var(--accent-h)]">Correo electrónico</label>
                  <input
                    type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                    placeholder="tu@correo.com"
                    className="w-full px-4 py-2.5 rounded-[10px] bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label)] placeholder:text-[var(--label-3)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-shadow duration-[160ms] text-sm"
                  />
                </div>
                <div className="group">
                  <label className="block text-sm font-medium text-[var(--label)] mb-1.5 transition-colors duration-[160ms] group-focus-within:text-[var(--accent-h)]">Mensaje</label>
                  <textarea
                    value={message} onChange={(e) => setMessage(e.target.value)} required
                    rows={4} placeholder="¿En qué podemos ayudarte?"
                    className="w-full px-4 py-2.5 rounded-[10px] bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label)] placeholder:text-[var(--label-3)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-shadow duration-[160ms] text-sm resize-none"
                  />
                </div>
                <button
                  type="submit" disabled={contact.isPending}
                  className="w-full py-2.5 bg-[var(--accent)] text-white font-semibold rounded-[10px] hover:bg-[var(--accent-h)] active:scale-[0.98] disabled:opacity-50 transition-[transform,background-color] duration-[160ms] text-sm"
                >
                  {contact.isPending ? 'Enviando...' : 'Enviar mensaje'}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
