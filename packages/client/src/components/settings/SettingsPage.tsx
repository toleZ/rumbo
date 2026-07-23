import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import {
  User, Palette, Bell, Plug, KeyRound, Trash2, Sun, Moon, Eye, EyeOff, X, Music2, CalendarDays, Zap, Hand, Ban,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../stores/authStore'
import { useUIStore } from '../../stores/uiStore'
import { useTaskStore } from '../../stores/taskStore'
import { trpc } from '../../lib/trpc'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Switch } from '../ui/Switch'
import { Checkbox } from '../ui/Checkbox'
import i18n from '../../lib/i18n'

// Same override env var the SpotifyWidget uses for the raw (non-tRPC) authorize redirect.
const SPOTIFY_AUTHORIZE_URL = import.meta.env.VITE_API_SPOTIFY_AUTHORIZE_URL ?? '/api/connections/spotify/authorize'
const GOOGLE_AUTHORIZE_URL = import.meta.env.VITE_API_GOOGLE_AUTHORIZE_URL ?? '/api/connections/google/authorize'

// Computed once at module load, not per-render — Intl.supportedValuesOf('timeZone') has
// been available in evergreen browsers since 2022; a short static fallback covers any
// environment where it isn't (it's only used to populate the Settings dropdown, so a
// smaller list there is a minor UX gap, not a correctness issue).
const timezoneOptions: string[] = (() => {
  try {
    return Intl.supportedValuesOf('timeZone')
  } catch {
    return ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Argentina/Buenos_Aires', 'America/Sao_Paulo', 'America/Mexico_City', 'Europe/London', 'Europe/Madrid', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Australia/Sydney']
  }
})()

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

// Mirrors DeleteAccountModal's structure (backdrop, focus trap, Escape-to-close,
// animate-overlay-in/animate-modal-in) minus the password field — this codebase confirms
// destructive-but-reversible actions with either this modal pattern (delete account) or an
// inline toast-confirm (delete board/column); a disconnect is closer in weight to the
// former (it's a Settings-page action with a visible "are you sure" moment expected).
function DisconnectConfirmModal({ label, onClose, onConfirm, isPending }: {
  label: string
  onClose: () => void
  onConfirm: () => void
  isPending: boolean
}) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef)

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
        aria-labelledby="disconnect-confirm-title"
        className="relative bg-[var(--surface)] rounded-[var(--radius-2xl)] shadow-[var(--shadow-xl)] border border-[var(--sep)] w-full max-w-sm mx-4 flex flex-col animate-modal-in"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--sep)]">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] bg-[rgba(239,68,68,0.12)]">
              <Plug className="h-4 w-4 text-[var(--danger)]" strokeWidth={2.25} />
            </span>
            <h2 id="disconnect-confirm-title" className="text-base font-semibold text-[var(--label)]">
              {t('settings.connections.disconnectConfirmTitle')}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--surface-2)] transition-[background-color,transform] duration-[160ms] active:scale-90">
            <X className="w-4 h-4 text-[var(--label-3)]" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-[var(--label-2)]">{t('settings.connections.disconnectConfirmBody', { name: label })}</p>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1 text-[var(--label)]">
              {t('common.cancel')}
            </Button>
            <Button type="button" variant="danger" onClick={onConfirm} disabled={isPending} loading={isPending} className="flex-1">
              {t('settings.connections.disconnect')}
            </Button>
          </div>
        </div>
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
  // Resynced from the authed user only when the underlying value actually changes (e.g.
  // after a successful save, or once the user object first loads) — done as a
  // render-time state adjustment (React's documented alternative to useEffect for "reset
  // state when a value changes": https://react.dev/learn/you-might-not-need-an-effect),
  // matching the pattern already used for the Spotify widget's progress/volume sync,
  // rather than a setState-in-effect (flagged by react-hooks/set-state-in-effect).
  const nameKey = user?.name ?? null
  const [syncedNameKey, setSyncedNameKey] = useState<string | null>(null)
  const [name, setName] = useState('')
  if (nameKey !== syncedNameKey) {
    setSyncedNameKey(nameKey)
    setName(nameKey ?? '')
  }
  const nameDirty = name.trim().length > 0 && name.trim() !== (user?.name ?? '')

  // Falls back to the browser's detected zone so the select always has a sensible
  // default even before the user has ever saved one explicitly.
  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const timezoneKey = user?.timezone ?? null
  const [syncedTimezoneKey, setSyncedTimezoneKey] = useState<string | null>(null)
  const [timezone, setTimezone] = useState(detectedTimezone)
  if (timezoneKey !== syncedTimezoneKey) {
    setSyncedTimezoneKey(timezoneKey)
    setTimezone(timezoneKey ?? detectedTimezone)
  }
  const timezoneDirty = timezone !== (user?.timezone ?? detectedTimezone)
  const profileDirty = nameDirty || timezoneDirty

  const updateProfileMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: (data) => {
      updateUser({ name: data.name, timezone: data.timezone })
      toast.success(t('settings.profile.saved'))
    },
    onError: (err) => toast.error(err.message),
  })

  // --- Connections ---
  const utils = trpc.useUtils()
  const connectionsQuery = trpc.connections.list.useQuery()
  // One entry per provider — add a new Card row here when a new provider ships, rather
  // than a separate hand-written block per provider (the pattern the Spotify-only
  // version of this section used before Google was added).
  const providerConfigs = [
    {
      key: 'spotify' as const,
      icon: Music2,
      label: t('settings.connections.spotify'),
      desc: t('settings.connections.spotifyDesc'),
      authorizeUrl: SPOTIFY_AUTHORIZE_URL,
    },
    {
      key: 'google_calendar' as const,
      icon: CalendarDays,
      label: t('settings.connections.googleCalendar'),
      desc: t('settings.connections.googleCalendarDesc'),
      authorizeUrl: GOOGLE_AUTHORIZE_URL,
    },
  ]
  const [disconnectTarget, setDisconnectTarget] = useState<{ key: 'spotify' | 'google_calendar'; label: string } | null>(null)
  const disconnectMutation = trpc.connections.disconnect.useMutation({
    onSuccess: (_, variables) => {
      utils.connections.list.invalidate()
      // connections.list flips `connected` to false everywhere reactively, but a disabled
      // query only stops refetching — it doesn't clear its previously-fetched data, so the
      // Calendar page's overlay would otherwise keep showing stale Google events until a
      // full page reload. Purge it explicitly instead.
      if (variables.provider === 'google_calendar') {
        utils.connections.googleCalendarEvents.reset()
      }
      setDisconnectTarget(null)
    },
    onError: (err) => toast.error(err.message),
  })

  // --- Google Calendar sync settings ---
  const isGoogleCalendarConnected = Boolean(connectionsQuery.data?.find((c) => c.provider === 'google_calendar')?.connected)
  const boards = useTaskStore((s) => s.boards)
  const googleSyncSettingsQuery = trpc.connections.googleSyncSettings.useQuery(undefined, { enabled: isGoogleCalendarConnected })
  // Requires the calendar.calendarlist.readonly scope, added after this feature's
  // original launch — an already-connected account from before will get a 403 here until
  // it reconnects; handled as a graceful fallback in the UI, not a hard error.
  const googleCalendarsQuery = trpc.connections.googleCalendars.useQuery(undefined, { enabled: isGoogleCalendarConnected, retry: false })
  const updateGoogleSyncSettingsMutation = trpc.connections.updateGoogleSyncSettings.useMutation({
    onSuccess: () => utils.connections.googleSyncSettings.invalidate(),
    onError: (err) => toast.error(err.message),
  })

  const autoSyncMode = googleSyncSettingsQuery.data?.autoSyncMode ?? 'off'
  const syncBoardIds = googleSyncSettingsQuery.data?.syncBoardIds ?? []
  const allBoardIds = boards.map((b) => b.id)
  // Empty syncBoardIds means "no restriction" server-side — for checkbox display we treat
  // that the same as "every board checked" rather than showing an empty, all-unchecked list.
  const checkedBoardIds = syncBoardIds.length > 0 ? syncBoardIds : allBoardIds

  const toggleSyncBoard = (boardId: string) => {
    const next = checkedBoardIds.includes(boardId)
      ? checkedBoardIds.filter((id) => id !== boardId)
      : [...checkedBoardIds, boardId]
    // Collapse back to [] (no restriction) once every board is checked again, so the
    // stored representation stays canonical instead of drifting into an equivalent-but-
    // different explicit full list.
    updateGoogleSyncSettingsMutation.mutate({ syncBoardIds: next.length === allBoardIds.length ? [] : next })
  }

  const calendars = googleCalendarsQuery.data ?? []
  const primaryCalendarId = calendars.find((c) => c.primary)?.id
  const selectedCalendarId = googleSyncSettingsQuery.data?.calendarId ?? primaryCalendarId ?? ''

  // If the previously-selected target calendar has disappeared from the account (deleted,
  // unshared) the stored setting is no longer usable — reset it back to primary instead of
  // leaving the <select> stuck on a value with no matching option and every future
  // push/read silently failing against an id that no longer exists.
  useEffect(() => {
    const storedId = googleSyncSettingsQuery.data?.calendarId
    const list = googleCalendarsQuery.data
    if (!storedId || !list || list.length === 0) return
    if (list.some((c) => c.id === storedId)) return
    updateGoogleSyncSettingsMutation.mutate({ calendarId: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleSyncSettingsQuery.data?.calendarId, googleCalendarsQuery.data])

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
              onSubmit={(e) => {
                e.preventDefault()
                if (!profileDirty) return
                // Only send name when it actually changed — a timezone-only save (e.g. a
                // user who never set a name, which is optional at registration) must never
                // send an empty string and overwrite it.
                updateProfileMutation.mutate({
                  ...(nameDirty ? { name: name.trim() } : {}),
                  timezone: timezoneDirty ? timezone : undefined,
                })
              }}
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
              <div className="group">
                <label className={sectionLabel}>{t('settings.profile.timezone')}</label>
                <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={inputCls}>
                  {timezoneOptions.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                </select>
                <p className="mt-1.5 text-xs text-[var(--label-3)]">{t('settings.profile.timezoneDesc')}</p>
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={!profileDirty || updateProfileMutation.isPending} loading={updateProfileMutation.isPending}>
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
            {providerConfigs.map((cfg, i) => {
              const conn = connectionsQuery.data?.find((c) => c.provider === cfg.key)
              const Icon = cfg.icon
              const autoSyncDescKey = autoSyncMode === 'off'
                ? 'settings.connections.autoSyncDescOff'
                : autoSyncMode === 'per_task'
                  ? 'settings.connections.autoSyncDescPerTask'
                  : 'settings.connections.autoSyncDescAll'
              return (
                <div key={cfg.key} className={i > 0 ? 'border-t border-[var(--sep)]' : ''}>
                  <div className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-[var(--radius-lg)] bg-[var(--surface-2)] flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-[var(--label-2)]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--label)]">{cfg.label}</p>
                        <p className="text-xs text-[var(--label-3)] mt-0.5 truncate">
                          {conn?.connected
                            ? t('settings.connections.connectedAs', { name: conn.displayName || cfg.label })
                            : cfg.desc}
                        </p>
                      </div>
                    </div>
                    {conn?.connected ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDisconnectTarget({ key: cfg.key, label: cfg.label })}
                        disabled={disconnectMutation.isPending}
                        className="text-[var(--danger)]"
                      >
                        {t('settings.connections.disconnect')}
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => { window.location.href = cfg.authorizeUrl }}>
                        {t('settings.connections.connect')}
                      </Button>
                    )}
                  </div>

                  {cfg.key === 'google_calendar' && conn?.connected && (
                    <div className="px-4 pb-4 space-y-4">
                      {/* Auto-sync mode */}
                      <div>
                        <label className="block text-sm font-medium text-[var(--label-2)] mb-1.5">
                          {t('settings.connections.autoSyncMode')}
                        </label>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => updateGoogleSyncSettingsMutation.mutate({ autoSyncMode: 'off' })} className={segmentBtn(autoSyncMode === 'off')}>
                            <Ban className="w-4 h-4" /> {t('settings.connections.autoSyncOff')}
                          </button>
                          <button type="button" onClick={() => updateGoogleSyncSettingsMutation.mutate({ autoSyncMode: 'per_task' })} className={segmentBtn(autoSyncMode === 'per_task')}>
                            <Hand className="w-4 h-4" /> {t('settings.connections.autoSyncPerTask')}
                          </button>
                          <button type="button" onClick={() => updateGoogleSyncSettingsMutation.mutate({ autoSyncMode: 'all' })} className={segmentBtn(autoSyncMode === 'all')}>
                            <Zap className="w-4 h-4" /> {t('settings.connections.autoSyncAll')}
                          </button>
                        </div>
                        <p className="mt-1.5 text-xs text-[var(--label-3)]">{t(autoSyncDescKey)}</p>
                      </div>

                      {/* Board filter */}
                      {boards.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-[var(--label-2)] mb-1.5">
                            {t('settings.connections.syncBoards')}
                          </label>
                          <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                            {boards.map((board) => (
                              <label
                                key={board.id}
                                className="flex items-center gap-2.5 px-2 py-1.5 rounded-[var(--radius-md)] hover:bg-[var(--surface-2)] cursor-pointer transition-colors"
                              >
                                <Checkbox checked={checkedBoardIds.includes(board.id)} onChange={() => toggleSyncBoard(board.id)} />
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: board.color ?? '#6b7280' }} />
                                <span className="text-sm text-[var(--label)] truncate">{board.name}</span>
                              </label>
                            ))}
                          </div>
                          <p className="mt-1.5 text-xs text-[var(--label-3)]">{t('settings.connections.syncBoardsDesc')}</p>
                        </div>
                      )}

                      {/* Target calendar */}
                      <div>
                        <label className={sectionLabel}>{t('settings.connections.targetCalendar')}</label>
                        {googleCalendarsQuery.isError ? (
                          <p className="text-xs text-[var(--label-3)]">{t('settings.connections.targetCalendarReconnect')}</p>
                        ) : (
                          <select
                            value={selectedCalendarId}
                            disabled={googleCalendarsQuery.isLoading || calendars.length === 0}
                            onChange={(e) => {
                              const chosen = calendars.find((c) => c.id === e.target.value)
                              updateGoogleSyncSettingsMutation.mutate({ calendarId: chosen?.primary ? null : e.target.value })
                            }}
                            className={inputCls}
                          >
                            {calendars.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.summary}{c.primary ? ` (${t('settings.connections.primaryCalendar')})` : ''}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
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

      {disconnectTarget && (
        <DisconnectConfirmModal
          label={disconnectTarget.label}
          onClose={() => setDisconnectTarget(null)}
          isPending={disconnectMutation.isPending}
          onConfirm={() => disconnectMutation.mutate({ provider: disconnectTarget.key })}
        />
      )}
    </div>
  )
}
