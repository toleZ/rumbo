import { create } from 'zustand'

interface AuthUser {
  id: string
  email: string
  name: string | null
}

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

function readStoredUser(): AuthUser | null {
  try {
    // rememberMe=true  → authUser in localStorage  (persists across browser close)
    // rememberMe=false → authUser in sessionStorage (cleared when browser closes)
    const raw =
      localStorage.getItem('authUser') ?? sessionStorage.getItem('authUser')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: readStoredUser(),
  // Access token is never persisted — always in memory only (XSS-safe)
  accessToken: null,
  // Start loading if there's a stored user — App.tsx will trigger a silent refresh
  isLoading: !!(localStorage.getItem('authUser') || sessionStorage.getItem('authUser')),

  setSession: (user, accessToken, rememberMe = true) => {
    window.dispatchEvent(new CustomEvent('auth:session-cleared'))
    localStorage.setItem('rememberMePref', String(rememberMe))
    if (rememberMe) {
      // Persistent: store user in localStorage so it survives browser close
      localStorage.setItem('authUser', JSON.stringify(user))
      sessionStorage.removeItem('authUser')
      sessionStorage.removeItem('sessionAlive')
    } else {
      // Non-persistent: store user in sessionStorage only — auto-cleared on browser close
      sessionStorage.setItem('authUser', JSON.stringify(user))
      // Sentinel: distinguishes "page refresh" from "browser closed" on startup
      sessionStorage.setItem('sessionAlive', '1')
      localStorage.removeItem('authUser')
    }
    set({ user, accessToken, isLoading: false })
  },

  setAccessToken: (token) => {
    set({ accessToken: token, isLoading: false })
  },

  // Patches the logged-in user (e.g. after a profile-name edit) without touching
  // the token or firing auth:session-cleared — that event wipes query caches and
  // per-user stores, which a simple field edit must not do. Re-persists to
  // whichever storage setSession originally used, matching readStoredUser's lookup.
  updateUser: (partial) => {
    set((state) => {
      if (!state.user) return state
      const user = { ...state.user, ...partial }
      const target = localStorage.getItem('authUser') ? localStorage : sessionStorage
      target.setItem('authUser', JSON.stringify(user))
      return { user }
    })
  },

  clearSession: () => {
    window.dispatchEvent(new CustomEvent('auth:session-cleared'))
    localStorage.removeItem('authUser')
    localStorage.removeItem('rememberMePref')
    sessionStorage.removeItem('authUser')
    sessionStorage.removeItem('sessionAlive')
    set({ user: null, accessToken: null, isLoading: false })
  },

  setLoading: (isLoading) => set({ isLoading }),
}))
