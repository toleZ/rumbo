import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import {
  User, Palette, Bell, Plug, KeyRound, Trash2, Sun, Moon, Eye, EyeOff, X, Music2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../stores/authStore'
import { useUIStore } from '../../stores/uiStore'
import { trpc } from '../../lib/trpc'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Switch } from '../ui/Switch'
import i18n from '../../lib/i18n'

// Same override env var the SpotifyWidget uses for the raw (non-tRPC) authorize redirect.
const SPOTIFY_AUTHORIZE_URL = import.meta.env.VITE_API_SPOTIFY_AUTHORIZE_URL ?? '/api/connections/spotify/authorize'

const inputCls = 'w-full px-3 py-2.5 text-sm rounded-[var(--radius-lg)] bg-[var(--surface-2)] border border-[var(--sep)] text-[var(--label)] placeholder:text-[var(--label-3)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-shadow duration-[160ms]'
const sectionLabel = 'block text-sm font-medium text-[var(--label-2)] mb-1.5 transition-colors duration-[160ms] group-focus-within:text-[var(--accent-h)]'
const segmentBtn = (active: boolean) =>
  `flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium rounded-[var(--radius-lg)] border transition-[background-color,border-color,color,transform] duration-[160ms] active:scale-[0.97] ${
    active
      ? 'border-[var(--accent)] bg-[var(--accent-f)] text-[var(--accent)]'
      : 'border-[var(--sep)] text-[var(--label-2)] hover:bg-[var(--surface-2)]'
  }`

function DeleteAccountModal({ onClose, onConfirm, isPending }: {
  onClose: () => void
  onConfirm: (password: string) => void
  isPending: boolean
}) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef)
  const [password, setPassword] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-overlay-in" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        className="relative bg-[var(--surface)] rounded-[var(--radius-2xl)] shadow-[var(--shadow-xl)] border border-[var(--sep)] w-full max-w-md mx-4 flex flex-col animate-modal-in"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--sep)]">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] bg-[rgba(239,68,68,0.12)]">
              <Trash2 className="h-4 w-4 text-[var(--danger)]" strokeWidth={2.25} />
            </span>
            <h2 id="delete-account-title" className="text-base font-semibold text-[var(--label)]">
              {t('settings.danger.confirmTitle')}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--surface-2)] transition-[background-color,transform] duration-[160ms] active:scale-90">
            <X className="w-4 h-4 text-[var(--label-3)]" />
          </button>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); onConfirm(password) }}
          className="p-6 space-y-4"
        >
          <p className="text-sm text-[var(--label-2)]">{t('settings.danger.confirmBody')}</p>
          <div className="group">
            <label className={sectionLabel}>{t('settings.danger.confirmPassword')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              className={inputCls}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1 text-[var(--label)]">
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="danger" disabled={!password || isPending} loading={isPending} className="flex-1">
              {t('settings.danger.confirmDelete')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function SettingsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, clearSession, updateUser } = useAuthStore(useShallow((s) => ({
    user: s.user,
    clearSession: s.clearSession,
    updateUser: s.updateUser,
  })))
  const { theme, toggleTheme, language, setLanguage, notificationsEnabled, setNotificationsEnabled } = useUIStore(useShallow((s) => ({
    theme: s.theme,
    toggleTheme: s.toggleTheme,
    language: s.language,
    setLanguage: s.setLanguage,
    notificationsEnabled: s.notificationsEnabled,
    setNotificationsEnabled: s.setNotificationsEnabled,
  })))

  // --- Profile ---
  const [name, setName] = useState(user?.name ?? '')
  useEffect(() => { setName(user?.name ?? '') }, [user?.name])
  const nameDirty = name.trim().length > 0 && name.trim() !== (user?.name ?? '')

  const updateProfileMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: (data) => {
      updateUser({ name: data.name })
      toast.success(t('settings.profile.saved'))
    },
    onError: (err) => toast.error(err.message),
  })

  // --- Connections ---
  const utils = trpc.useUtils()
  const connectionsQuery = trpc.connections.list.useQuery()
  const spotifyConnection = connectionsQuery.data?.find((c) => c.provider === 'spotify')
  const disconnectMutation = trpc.connections.disconnect.useMutation({
    onSuccess: () => utils.connections.list.invalidate(),
    onError: (err) => toast.error(err.message),
  })

  // Surfaces the result of the Spotify OAuth redirect (see App.tsx, which routes here
  // on `?connection=...`) and strips the query params so a refresh doesn't re-toast.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const connection = params.get('connection')
    if (!connection) return

    if (params.get('status') === 'connected') {
      toast.success(t('settings.connections.connected', { provider: connection }))
    } else {
      toast.error(t('settings.connections.connectError', { provider: connection }))
    }
    utils.connections.list.invalidate()
    window.history.replaceState(null, '', window.location.pathname)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- Security ---
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword
  const canChangePassword = currentPassword.length > 0 && newPassword.length >= 8 && newPassword === confirmPassword

  const changePasswordMutation = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      toast.success(t('settings.security.changed'))
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    },
    onError: (err) => toast.error(err.message),
  })

  // --- Danger zone ---
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const deleteAccountMutation = trpc.auth.deleteAccount.useMutation({
    onSuccess: () => {
      // clearSession fires auth:session-cleared, which App.tsx already wires up
      // to clear the query cache and reset every per-user store.
      clearSession()
      navigate('/login')
      toast.success(t('settings.danger.deleted'))
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })

  const setThemeTo = (target: 'light' | 'dark') => { if (theme !== target) toggleTheme() }
  const setLanguageTo = (lang: 'es' | 'en') => {
    if (language === lang) return
    i18n.changeLanguage(lang)
    setLanguage(lang)
  }

  return (
    <div className="h-full overflow-y-auto bg-[var(--bg)]">
      <div className="max-w-xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-[var(--label)] mb-6">{t('settings.title')}</h1>

        <div className="space-y-4 stagger-children">
          {/* Profile */}
          <Card>
            <Card.Header icon={<User className="w-4 h-4 text-[var(--label-2)]" />} title={t('settings.profile.title')} />
            <form
              onSubmit={(e) => { e.preventDefault(); if (nameDirty) updateProfileMutation.mutate({ name: name.trim() }) }}
              className="p-4 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[var(--accent)] flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--label)] truncate">{user?.name || user?.email}</p>
                  <p className="text-xs text-[var(--label-3)] truncate">{user?.email}</p>
                </div>
              </div>
              <div className="group">
                <label className={sectionLabel}>{t('settings.profile.name')}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('settings.profile.namePlaceholder')}
                  className={inputCls}
                />
              </div>
              <div className="group">
                <label className={sectionLabel}>{t('settings.profile.email')}</label>
                <input type="email" value={user?.email ?? ''} disabled className={`${inputCls} opacity-60 cursor-not-allowed`} />
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={!nameDirty || updateProfileMutation.isPending} loading={updateProfileMutation.isPending}>
                  {t('common.save')}
                </Button>
              </div>
            </form>
          </Card>

          {/* Appearance & language */}
          <Card>
            <Card.Header icon={<Palette className="w-4 h-4 text-[var(--label-2)]" />} title={t('settings.appearance.title')} />
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--label-2)] mb-1.5">{t('settings.appearance.theme')}</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setThemeTo('light')} className={segmentBtn(theme === 'light')}>
                    <Sun className="w-4 h-4" /> {t('settings.appearance.light')}
                  </button>
                  <button type="button" onClick={() => setThemeTo('dark')} className={segmentBtn(theme === 'dark')}>
                    <Moon className="w-4 h-4" /> {t('settings.appearance.dark')}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--label-2)] mb-1.5">{t('settings.appearance.language')}</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setLanguageTo('es')} className={segmentBtn(language === 'es')}>
                    {t('settings.appearance.spanish')}
                  </button>
                  <button type="button" onClick={() => setLanguageTo('en')} className={segmentBtn(language === 'en')}>
                    {t('settings.appearance.english')}
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {/* Notifications */}
          <Card>
            <Card.Header icon={<Bell className="w-4 h-4 text-[var(--label-2)]" />} title={t('settings.notifications.title')} />
            <div className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--label)]">{t('settings.notifications.remindersLabel')}</p>
                <p className="text-xs text-[var(--label-3)] mt-0.5">{t('settings.notifications.remindersDesc')}</p>
              </div>
              <Switch
                checked={notificationsEnabled}
                onChange={setNotificationsEnabled}
                label={t('settings.notifications.remindersLabel')}
              />
            </div>
          </Card>

          {/* Connections */}
          <Card>
            <Card.Header icon={<Plug className="w-4 h-4 text-[var(--label-2)]" />} title={t('settings.connections.title')} />
            <div className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-[var(--radius-lg)] bg-[var(--surface-2)] flex items-center justify-center shrink-0">
                  <Music2 className="w-4 h-4 text-[var(--label-2)]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--label)]">{t('settings.connections.spotify')}</p>
                  <p className="text-xs text-[var(--label-3)] mt-0.5 truncate">
                    {spotifyConnection?.connected
                      ? t('settings.connections.connectedAs', { name: spotifyConnection.displayName || t('settings.connections.spotify') })
                      : t('settings.connections.spotifyDesc')}
                  </p>
                </div>
              </div>
              {spotifyConnection?.connected ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => disconnectMutation.mutate({ provider: 'spotify' })}
                  disabled={disconnectMutation.isPending}
                  loading={disconnectMutation.isPending}
                  className="text-[var(--danger)]"
                >
                  {t('settings.connections.disconnect')}
                </Button>
              ) : (
                <Button size="sm" onClick={() => { window.location.href = SPOTIFY_AUTHORIZE_URL }}>
                  {t('settings.connections.connect')}
                </Button>
              )}
            </div>
            <p className="px-4 pb-4 text-xs text-[var(--label-3)]">{t('settings.connections.comingSoonDesc')}</p>
          </Card>

          {/* Security */}
          <Card>
            <Card.Header icon={<KeyRound className="w-4 h-4 text-[var(--label-2)]" />} title={t('settings.security.title')} />
            <form
              onSubmit={(e) => { e.preventDefault(); if (canChangePassword) changePasswordMutation.mutate({ currentPassword, newPassword }) }}
              className="p-4 space-y-4"
            >
              <div className="group">
                <label className={sectionLabel}>{t('settings.security.currentPassword')}</label>
                <div className="relative">
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className={`${inputCls} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--label-3)] hover:text-[var(--label-2)] transition-colors"
                  >
                    {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 group">
                  <label className={sectionLabel}>{t('settings.security.newPassword')}</label>
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={8}
                    className={inputCls}
                  />
                </div>
                <div className="flex-1 group">
                  <label className={sectionLabel}>{t('settings.security.confirmPassword')}</label>
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>
              {passwordsMismatch && (
                <p className="text-xs text-[var(--danger)]">{t('settings.security.mismatch')}</p>
              )}
              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={!canChangePassword || changePasswordMutation.isPending}
                  loading={changePasswordMutation.isPending}
                >
                  {t('settings.security.changePassword')}
                </Button>
              </div>
            </form>
          </Card>

          {/* Danger zone */}
          <Card className="border-[rgba(239,68,68,0.3)]">
            <Card.Header icon={<Trash2 className="w-4 h-4 text-[var(--danger)]" />} title={t('settings.danger.title')} />
            <div className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--label)]">{t('settings.danger.deleteAccount')}</p>
                <p className="text-xs text-[var(--label-3)] mt-0.5">{t('settings.danger.deleteAccountDesc')}</p>
              </div>
              <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)}>
                {t('common.delete')}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {showDeleteModal && (
        <DeleteAccountModal
          onClose={() => setShowDeleteModal(false)}
          isPending={deleteAccountMutation.isPending}
          onConfirm={(password) => deleteAccountMutation.mutate({ password })}
        />
      )}
    </div>
  )
}
