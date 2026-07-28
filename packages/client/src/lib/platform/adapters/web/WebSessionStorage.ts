import type { AuthUser, ISessionStorage } from '../../ISessionStorage'

// The existing web behavior, relocated verbatim from `stores/authStore.ts` and the
// startup guard in `App.tsx`. No semantics change here — that is the whole point of
// this phase, and any divergence is a regression, not a refactor.
//
// rememberMe=true  → authUser in localStorage  (survives browser close)
// rememberMe=false → authUser in sessionStorage (cleared when the browser closes)

export class WebSessionStorage implements ISessionStorage {
  readonly kind = 'web' as const
  // The httpOnly cookie is the transport, so the token is never in JS reach and never
  // needs to be sent by hand.
  readonly usesBearerRefresh = false

  async hydrate(): Promise<void> {
    // Nothing to load: the cookie travels with the request, not through this class.
  }

  readStoredUser(): AuthUser | null {
    try {
      const raw =
        window.localStorage.getItem('authUser') ?? window.sessionStorage.getItem('authUser')
      return raw ? (JSON.parse(raw) as AuthUser) : null
    } catch { return null }
  }

  hasStoredSession(): boolean {
    return !!(window.localStorage.getItem('authUser') || window.sessionStorage.getItem('authUser'))
  }

  isAbandonedSession(): boolean {
    // Guard for legacy sessions: if authUser ended up in localStorage but rememberMe=false
    // and the sessionAlive sentinel is gone, the browser was closed → discard the session.
    // (New sessions write authUser to sessionStorage directly, so this handles old data.)
    return (
      window.localStorage.getItem('rememberMePref') === 'false' &&
      !window.sessionStorage.getItem('sessionAlive') &&
      !!window.localStorage.getItem('authUser')
    )
  }

  persistUser(user: AuthUser, rememberMe: boolean): void {
    window.localStorage.setItem('rememberMePref', String(rememberMe))
    if (rememberMe) {
      window.localStorage.setItem('authUser', JSON.stringify(user))
      window.sessionStorage.removeItem('authUser')
      window.sessionStorage.removeItem('sessionAlive')
    } else {
      window.sessionStorage.setItem('authUser', JSON.stringify(user))
      // Sentinel: distinguishes "page refresh" from "browser closed" on startup.
      window.sessionStorage.setItem('sessionAlive', '1')
      window.localStorage.removeItem('authUser')
    }
  }

  updateStoredUser(user: AuthUser): void {
    // Re-persist to whichever storage persistUser originally used, matching
    // readStoredUser's lookup order.
    const target = window.localStorage.getItem('authUser') ? window.localStorage : window.sessionStorage
    target.setItem('authUser', JSON.stringify(user))
  }

  clearUser(): void {
    window.localStorage.removeItem('authUser')
    window.localStorage.removeItem('rememberMePref')
    window.sessionStorage.removeItem('authUser')
    window.sessionStorage.removeItem('sessionAlive')
  }

  getRefreshToken(): string | null {
    return null
  }

  async setRefreshToken(): Promise<void> {
    // No-op: the server sets and rotates the httpOnly cookie itself.
  }
}
