import { create } from 'zustand'
import { session } from '../lib/platform'
import type { AuthUser } from '../lib/platform'

export type { AuthUser }

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  isLoading: boolean
  setSession: (user: AuthUser, accessToken: string, rememberMe?: boolean) => void
  setAccessToken: (token: string) => void
  updateUser: (partial: Partial<AuthUser>) => void
  clearSession: () => void
  setLoading: (v: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  // Reads are synchronous by contract on ISessionStorage, precisely so this initializer
  // can stay at module load on every platform.
  user: session.readStoredUser(),
  // Access token is never persisted — always in memory only (XSS-safe)
  accessToken: null,
  // Start loading if there's a stored user — App.tsx will trigger a silent refresh
  isLoading: session.hasStoredSession(),

  setSession: (user, accessToken, rememberMe = true) => {
    window.dispatchEvent(new CustomEvent('auth:session-cleared'))
    session.persistUser(user, rememberMe)
    set({ user, accessToken, isLoading: false })
  },

  setAccessToken: (token) => {
    set({ accessToken: token, isLoading: false })
  },

  // Patches the logged-in user (e.g. after a profile-name edit) without touching
  // the token or firing auth:session-cleared — that event wipes query caches and
  // per-user stores, which a simple field edit must not do.
  updateUser: (partial) => {
    set((state) => {
      if (!state.user) return state
      const user = { ...state.user, ...partial }
      session.updateStoredUser(user)
      return { user }
    })
  },

  clearSession: () => {
    window.dispatchEvent(new CustomEvent('auth:session-cleared'))
    session.clearUser()
    set({ user: null, accessToken: null, isLoading: false })
  },

  setLoading: (isLoading) => set({ isLoading }),
}))
