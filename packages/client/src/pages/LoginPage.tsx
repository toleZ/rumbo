import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, LogIn, Clock, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { trpc } from '../lib/trpc'
import { useAuthStore } from '../stores/authStore'
import { prefersReducedMotion } from '../lib/motionPresets'
import toast from 'react-hot-toast'

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  // Motion state: shake the card on credential errors, flash a danger ring on
  // the inputs, morph the submit button green on success before navigating.
  const [shaking, setShaking] = useState(false)
  const [errorRing, setErrorRing] = useState(false)
  const [succeeded, setSucceeded] = useState(false)

  // Drives the mm:ss countdown for TOO_MANY_REQUESTS — retryAfterSeconds comes
  // from the server's rate-limit window (see trpc.ts errorFormatter), not a
  // client-side guess, so the countdown reflects exactly when the real
  // rate-limit window resets rather than an arbitrary/approximate number.
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (rateLimitedUntil === null) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [rateLimitedUntil])

  useEffect(() => {
    if (!errorRing) return
    const id = setTimeout(() => setErrorRing(false), 1200)
    return () => clearTimeout(id)
  }, [errorRing])

  const remainingMs = rateLimitedUntil !== null ? rateLimitedUntil - now : 0
  const isRateLimited = rateLimitedUntil !== null && remainingMs > 0
  useEffect(() => {
    if (rateLimitedUntil !== null && remainingMs <= 0) setRateLimitedUntil(null)
  }, [remainingMs, rateLimitedUntil])

  const login = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      setSession(data.user, data.accessToken, rememberMe)
      toast.success(t('auth.login.success'))
      if (prefersReducedMotion()) {
        navigate('/app')
        return
      }
      setSucceeded(true)
      setTimeout(() => navigate('/app'), 350)
    },
    onError: (err) => {
      const retryAfterSeconds = err.data?.retryAfterSeconds as number | undefined
      if (retryAfterSeconds) {
        setRateLimitedUntil(Date.now() + retryAfterSeconds * 1000)
        setNow(Date.now())
      }
      setShaking(true)
      setErrorRing(true)
      toast.error(err.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isRateLimited) return
    login.mutate({ email, password, rememberMe })
  }

  const inputRing = errorRing
    ? 'ring-2 ring-[var(--danger)]'
    : 'focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent'
  const countdownSeconds = Math.ceil(remainingMs / 1000)

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[var(--bg-2)] px-4 overflow-hidden">
      {/* Brand backdrop — echoes the landing hero's violet glow + compass
          watermark instead of a flat, isolated auth screen. */}
      <div
        className="absolute inset-0 pointer-events-none animate-glow-drift"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 0%, var(--accent-f) 0%, transparent 70%)' }}
        aria-hidden="true"
      />
      <svg
        className="absolute -left-24 -bottom-24 w-[420px] h-[420px] pointer-events-none opacity-[0.05] text-[var(--accent)]"
        viewBox="0 0 28 28"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="14" cy="14" r="13" stroke="currentColor" strokeWidth="1" fill="none" />
        <circle cx="14" cy="14" r="2" fill="currentColor" />
        <line x1="14" y1="4" x2="14" y2="8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <line x1="14" y1="20" x2="14" y2="24" stroke="currentColor" strokeWidth="0.75" strokeLinecap="round" />
        <line x1="4" y1="14" x2="8" y2="14" stroke="currentColor" strokeWidth="0.75" strokeLinecap="round" />
        <line x1="20" y1="14" x2="24" y2="14" stroke="currentColor" strokeWidth="0.75" strokeLinecap="round" />
        <polygon points="14,7 16.5,13 14,12 11.5,13" fill="currentColor" />
      </svg>

      <div className={`auth-stagger relative w-full max-w-md ${succeeded ? 'auth-success-out' : ''}`}>
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5 select-none mb-3">
            <svg width="30" height="30" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <circle cx="14" cy="14" r="13" stroke="var(--accent)" strokeWidth="2" fill="none" />
              <circle cx="14" cy="14" r="2" fill="var(--accent)" />
              <line x1="14" y1="4" x2="14" y2="8" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
              <line x1="14" y1="20" x2="14" y2="24" stroke="var(--label-3)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="4" y1="14" x2="8" y2="14" stroke="var(--label-3)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="20" y1="14" x2="24" y2="14" stroke="var(--label-3)" strokeWidth="1.5" strokeLinecap="round" />
              <polygon points="14,7 16.5,13 14,12 11.5,13" fill="var(--accent)" />
            </svg>
            <span className="font-display text-2xl font-semibold text-[var(--label)]">Rumbo</span>
          </Link>
          <p className="text-[var(--label-2)] text-sm">{t('auth.login.title')}</p>
        </div>

        <div
          className={`bg-[var(--surface)] rounded-[var(--radius-2xl)] shadow-[var(--shadow-xl)] border border-[var(--sep)] p-8 ${shaking ? 'animate-auth-shake' : ''}`}
          onAnimationEnd={() => setShaking(false)}
        >
          {isRateLimited && (
            <div className="mb-5 flex items-center gap-2.5 px-3.5 py-2.5 rounded-[var(--radius-lg)] bg-[rgba(255,59,48,0.08)] text-[var(--danger)] text-sm">
              <Clock className="w-4 h-4 shrink-0" />
              <span>{t('auth.login.rateLimited', { time: formatCountdown(remainingMs) })}</span>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="group">
              <label className="block text-sm font-medium text-[var(--label)] mb-1.5 transition-colors duration-[160ms] group-focus-within:text-[var(--accent-h)]">{t('auth.login.email')}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--label-3)] transition-[color,transform] duration-[160ms] group-focus-within:text-[var(--accent)] group-focus-within:scale-110" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder={t('auth.login.emailPlaceholder')}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-[var(--radius-lg)] bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label)] placeholder:text-[var(--label-3)] focus:outline-none transition-shadow duration-[160ms] text-sm ${inputRing}`}
                />
              </div>
            </div>

            <div className="group">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-[var(--label)] transition-colors duration-[160ms] group-focus-within:text-[var(--accent-h)]">{t('auth.login.password')}</label>
                <Link to="/forgot-password" className="text-xs text-[var(--accent)] hover:text-[var(--accent-h)]">
                  {t('auth.login.forgotPassword')}
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--label-3)] transition-[color,transform] duration-[160ms] group-focus-within:text-[var(--accent)] group-focus-within:scale-110" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder={t('auth.login.passwordPlaceholder')}
                  className={`w-full pl-10 pr-10 py-2.5 rounded-[var(--radius-lg)] bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label)] placeholder:text-[var(--label-3)] focus:outline-none transition-shadow duration-[160ms] text-sm ${inputRing}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--label-3)] hover:text-[var(--label-2)] transition-colors"
                >
                  {showPassword
                    ? <EyeOff key="off" className="w-4 h-4 animate-icon-swap" />
                    : <Eye key="on" className="w-4 h-4 animate-icon-swap" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer"
              />
              <label htmlFor="rememberMe" className="text-sm text-[var(--label-2)] cursor-pointer select-none">
                {t('auth.login.rememberMe')}
              </label>
            </div>

            <button
              type="submit"
              disabled={login.isPending || isRateLimited || succeeded}
              className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 disabled:opacity-50 text-white font-semibold rounded-[var(--radius-lg)] transition-colors duration-300 text-sm ${
                succeeded
                  ? 'bg-[var(--success)] disabled:opacity-100'
                  : 'bg-[var(--accent)] hover:bg-[var(--accent-h)]'
              }`}
            >
              {succeeded
                ? <><Check key="check" className="w-4 h-4 animate-icon-swap" />{t('auth.login.submit')}</>
                : isRateLimited
                  ? <><Clock className="w-4 h-4" /><span key={countdownSeconds} className="inline-block animate-digit-tick tabular-nums">{formatCountdown(remainingMs)}</span></>
                  : <><LogIn className="w-4 h-4" />{login.isPending ? t('auth.login.submitting') : t('auth.login.submit')}</>}
            </button>
          </form>

          <p className="text-center text-sm text-[var(--label-2)] mt-6">
            {t('auth.login.noAccount')}{' '}
            <Link to="/register" className="text-[var(--accent)] hover:text-[var(--accent-h)] font-medium">
              {t('auth.login.register')}
            </Link>
          </p>
        </div>

        {import.meta.env.DEV && (
          <p className="text-center text-xs text-[var(--label-3)] mt-6">
            {t('auth.login.demoHint')}
          </p>
        )}
      </div>
    </div>
  )
}
