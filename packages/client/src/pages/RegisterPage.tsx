import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, User, Eye, EyeOff, UserPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { trpc } from '../lib/trpc'
import toast from 'react-hot-toast'

export function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)

  const register = trpc.auth.register.useMutation({
    onSuccess: () => {
      toast.success(t('auth.register.success'))
      navigate(`/verify?email=${encodeURIComponent(email)}&rememberMe=${rememberMe}`)
    },
    onError: (err) => { toast.error(err.message) },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    register.mutate({ name, email, password })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-2)] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[var(--label)]">Rumbo</h1>
          <p className="text-[var(--label-2)] mt-2 text-sm">{t('auth.register.title')}</p>
        </div>

        <div className="bg-[var(--surface)] rounded-[16px] shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-[var(--sep)] p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[var(--label)] mb-1.5">{t('auth.register.name')}</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--label-3)]" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('auth.register.namePlaceholder')}
                  className="w-full pl-10 pr-4 py-2.5 rounded-[10px] bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label)] placeholder:text-[var(--label-3)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--label)] mb-1.5">{t('auth.register.email')}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--label-3)]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder={t('auth.register.emailPlaceholder')}
                  className="w-full pl-10 pr-4 py-2.5 rounded-[10px] bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label)] placeholder:text-[var(--label-3)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--label)] mb-1.5">{t('auth.register.password')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--label-3)]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder={t('auth.register.passwordPlaceholder')}
                  className="w-full pl-10 pr-10 py-2.5 rounded-[10px] bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label)] placeholder:text-[var(--label-3)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent text-sm"
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

            <div className="flex items-center gap-2">
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer"
              />
              <label htmlFor="rememberMe" className="text-sm text-[var(--label-2)] cursor-pointer select-none">
                {t('auth.register.rememberMe')}
              </label>
            </div>

            <button
              type="submit"
              disabled={register.isPending}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[var(--accent)] hover:bg-[var(--accent-h)] disabled:opacity-50 text-white font-semibold rounded-[10px] transition-colors text-sm"
            >
              <UserPlus className="w-4 h-4" />
              {register.isPending ? t('auth.register.submitting') : t('auth.register.submit')}
            </button>
          </form>

          <p className="text-center text-sm text-[var(--label-2)] mt-6">
            {t('auth.register.hasAccount')}{' '}
            <Link to="/login" className="text-[var(--accent)] hover:text-[var(--accent-h)] font-medium">
              {t('auth.register.login')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
