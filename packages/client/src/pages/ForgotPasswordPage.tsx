import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, KeyRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { trpc } from '../lib/trpc'
import toast from 'react-hot-toast'

export function ForgotPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [step, setStep] = useState<'email' | 'reset'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const forgot = trpc.auth.forgotPassword.useMutation({
    onSuccess: () => {
      toast.success(t('auth.forgot.codeSent'))
      setStep('reset')
    },
    onError: (err) => toast.error(err.message),
  })

  const reset = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      toast.success(t('auth.forgot.resetSuccess'))
      navigate('/login')
    },
    onError: (err) => toast.error(err.message),
  })

  if (step === 'email') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-2)] px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[rgba(255,149,0,0.10)] mb-4">
              <KeyRound className="w-7 h-7 text-[var(--warning)]" />
            </div>
            <h1 className="text-2xl font-bold text-[var(--label)]">{t('auth.forgot.title')}</h1>
            <p className="text-[var(--label-2)] mt-2 text-sm">{t('auth.forgot.subtitle')}</p>
          </div>

          <div className="bg-[var(--surface)] rounded-[16px] shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-[var(--sep)] p-8">
            <form onSubmit={(e) => { e.preventDefault(); forgot.mutate({ email }) }} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-[var(--label)] mb-1.5">{t('auth.forgot.email')}</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--label-3)]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder={t('auth.forgot.emailPlaceholder')}
                    className="w-full pl-10 pr-4 py-2.5 rounded-[10px] bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label)] placeholder:text-[var(--label-3)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={forgot.isPending}
                className="w-full py-2.5 px-4 bg-[var(--accent)] hover:bg-[var(--accent-h)] disabled:opacity-50 text-white font-semibold rounded-[10px] transition-colors text-sm"
              >
                {forgot.isPending ? t('auth.forgot.submitting') : t('auth.forgot.submit')}
              </button>
            </form>

            <p className="text-center text-sm text-[var(--label-2)] mt-6">
              <Link to="/login" className="text-[var(--accent)] hover:text-[var(--accent-h)]">
                {t('auth.forgot.backToLogin')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-2)] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[rgba(255,149,0,0.10)] mb-4">
            <Lock className="w-7 h-7 text-[var(--warning)]" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--label)]">{t('auth.forgot.resetTitle')}</h1>
          <p className="text-[var(--label-2)] mt-2 text-sm">{t('auth.forgot.resetSubtitle')}</p>
        </div>

        <div className="bg-[var(--surface)] rounded-[16px] shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-[var(--sep)] p-8">
          <form onSubmit={(e) => { e.preventDefault(); reset.mutate({ email, code, newPassword }) }} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[var(--label)] mb-1.5">{t('auth.forgot.verifyCode')}</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                placeholder={t('auth.forgot.verifyCodePlaceholder')}
                maxLength={6}
                className="w-full px-4 py-3 rounded-[10px] bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label)] placeholder:text-[var(--label-3)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-2xl text-center tracking-[0.5em] font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--label)] mb-1.5">{t('auth.forgot.newPassword')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--label-3)]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder={t('auth.forgot.newPasswordPlaceholder')}
                  className="w-full pl-10 pr-10 py-2.5 rounded-[10px] bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label)] placeholder:text-[var(--label-3)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--label-3)] hover:text-[var(--label-2)] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={reset.isPending || code.length !== 6}
              className="w-full py-2.5 px-4 bg-[var(--accent)] hover:bg-[var(--accent-h)] disabled:opacity-50 text-white font-semibold rounded-[10px] transition-colors text-sm"
            >
              {reset.isPending ? t('auth.forgot.resetSubmitting') : t('auth.forgot.resetSubmit')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
