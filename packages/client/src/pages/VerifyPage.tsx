import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { ShieldCheck, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { trpc } from '../lib/trpc'
import { useAuthStore } from '../stores/authStore'
import { prefersReducedMotion } from '../lib/motionPresets'
import toast from 'react-hot-toast'

export function VerifyPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const setSession = useAuthStore((s) => s.setSession)

  const emailFromQuery = params.get('email') || ''
  const rememberMeFromQuery = params.get('rememberMe') !== 'false'
  const [email, setEmail] = useState(emailFromQuery)
  const [code, setCode] = useState('')
  const [shaking, setShaking] = useState(false)
  const [succeeded, setSucceeded] = useState(false)

  const verify = trpc.auth.verifyEmail.useMutation({
    onSuccess: (data) => {
      setSession(data.user, data.accessToken, rememberMeFromQuery)
      toast.success(t('auth.verify.success'))
      if (prefersReducedMotion()) {
        navigate('/app')
        return
      }
      setSucceeded(true)
      setTimeout(() => navigate('/app'), 350)
    },
    onError: (err) => {
      setShaking(true)
      toast.error(err.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    verify.mutate({ email, code, rememberMe: rememberMeFromQuery })
  }

  const labelCls = 'block text-sm font-medium text-[var(--label)] mb-1.5 transition-colors duration-[160ms] group-focus-within:text-[var(--accent-h)]'

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[var(--bg-2)] px-4 overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none animate-glow-drift"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 0%, var(--accent-f) 0%, transparent 70%)' }}
        aria-hidden="true"
      />
      <div className={`auth-stagger relative w-full max-w-md ${succeeded ? 'auth-success-out' : ''}`}>
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--accent-f)] mb-4">
            <ShieldCheck className="w-7 h-7 text-[var(--accent)]" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--label)]">{t('auth.verify.title')}</h1>
          <p className="text-[var(--label-2)] mt-2 text-sm">{t('auth.verify.subtitle')}</p>
        </div>

        <div
          className={`bg-[var(--surface)] rounded-[16px] shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-[var(--sep)] p-8 ${shaking ? 'animate-auth-shake' : ''}`}
          onAnimationEnd={() => setShaking(false)}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            {!emailFromQuery && (
              <div className="group">
                <label className={labelCls}>{t('auth.verify.email')}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder={t('auth.verify.emailPlaceholder')}
                  className="w-full px-4 py-2.5 rounded-[10px] bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label)] placeholder:text-[var(--label-3)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-shadow duration-[160ms] text-sm"
                />
              </div>
            )}

            <div className="group">
              <label className={labelCls}>{t('auth.verify.code')}</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                placeholder={t('auth.verify.codePlaceholder')}
                maxLength={6}
                className="w-full px-4 py-3 rounded-[10px] bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label)] placeholder:text-[var(--label-3)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-shadow duration-[160ms] text-2xl text-center tracking-[0.5em] font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={verify.isPending || code.length !== 6 || succeeded}
              className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 disabled:opacity-50 text-white font-semibold rounded-[10px] transition-colors duration-300 text-sm ${
                succeeded
                  ? 'bg-[var(--success)] disabled:opacity-100'
                  : 'bg-[var(--accent)] hover:bg-[var(--accent-h)]'
              }`}
            >
              {succeeded && <Check key="check" className="w-4 h-4 animate-icon-swap" />}
              {succeeded
                ? t('auth.verify.submit')
                : verify.isPending ? t('auth.verify.submitting') : t('auth.verify.submit')}
            </button>
          </form>

          <p className="text-center text-sm text-[var(--label-2)] mt-6">
            {t('auth.verify.wrongCode')}{' '}
            <Link to="/register" className="text-[var(--accent)] hover:text-[var(--accent-h)]">
              {t('auth.verify.registerAgain')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
