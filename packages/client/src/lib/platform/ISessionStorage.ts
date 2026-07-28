// How a session is persisted, abstracted over the two transports.
//
// Web: the refresh token is an httpOnly cookie the JS never sees; only the non-sensitive
// user profile is stored locally. Native: there is no shared cookie jar, so the refresh
// token travels in the response body and lives in OS secure storage.
//
// `stores/authStore.ts` and `App.tsx` consume this and stay completely unaware of which
// one they got.

export interface AuthUser {
  id: string
  email: string
  name: string | null
  timezone: string | null
}

export interface ISessionStorage {
  /** Lets UI branch (hide the rememberMe checkbox, hide Spotify) without importing the host check. */
  readonly kind: 'web' | 'native'
  /**
   * True when the refresh token travels out-of-band rather than as a cookie — the client
   * then identifies itself with `X-Rumbo-Client: native` so the server returns it.
   */
  readonly usesBearerRefresh: boolean

  /**
   * Loads the refresh token from (async) secure storage into an in-memory mirror.
   * No-op on web. Awaited exactly once, during App startup, before the silent refresh.
   */
  hydrate(): Promise<void>

  // ── User profile: all synchronous ──────────────────────────────────────────────
  // authStore builds its initial state at MODULE LOAD (`user:`, `isLoading:`), so these
  // cannot be async without rewriting the store and changing web's first-paint behavior.
  // That constraint is why only the refresh token — never the user — went to async
  // secure storage.

  readStoredUser(): AuthUser | null
  hasStoredSession(): boolean
  /**
   * Web: rememberMe was false and the browser has since been closed, so the stored
   * session must be discarded. Native: always false — an OS-killed process is not a
   * user closing a browser, and treating it as one would log the user out constantly.
   */
  isAbandonedSession(): boolean
  persistUser(user: AuthUser, rememberMe: boolean): void
  /** Patches the stored user in place, without touching rememberMe or the token. */
  updateStoredUser(user: AuthUser): void
  clearUser(): void

  // ── Refresh token ─────────────────────────────────────────────────────────────

  /**
   * Reads the in-memory mirror, NOT storage — deliberately synchronous because it is
   * called inside the tRPC refresh path, where an await would open ordering races
   * against the single-flight lock in `lib/trpc.ts`.
   * Web always returns null: the cookie is the transport.
   */
  getRefreshToken(): string | null
  /** Web is a no-op. Native updates the mirror synchronously, then persists. */
  setRefreshToken(token: string | null): Promise<void>
}
