import type { ConnectProvider, IOAuthLauncher } from '../../IOAuthLauncher'
import { API_BASE } from '../../apiBase'

// URL path segment per provider. Note Google's segment ('google') deliberately differs
// from its provider key ('google_calendar'), matching the server's route registration in
// `packages/server/src/index.ts`.
const PATH_SEGMENT: Record<ConnectProvider, string> = {
  spotify: 'spotify',
  google_calendar: 'google',
}

// Per-provider env overrides, kept for back-compat with existing deployments that set
// them. Unset → the API_BASE-relative default, character-identical to what each call site
// built inline before this indirection.
const OVERRIDE: Record<ConnectProvider, string | undefined> = {
  spotify: import.meta.env.VITE_API_SPOTIFY_AUTHORIZE_URL,
  google_calendar: import.meta.env.VITE_API_GOOGLE_AUTHORIZE_URL,
}

export function authorizeUrlFor(provider: ConnectProvider): string {
  return OVERRIDE[provider] ?? `${API_BASE}/api/connections/${PATH_SEGMENT[provider]}/authorize`
}

export class WebRedirectLauncher implements IOAuthLauncher {
  async startConnect(provider: ConnectProvider): Promise<void> {
    // A full top-level navigation, not fetch/window.open — the server's /authorize route
    // reads the httpOnly refresh cookie, which only rides along on a real navigation.
    window.location.href = authorizeUrlFor(provider)
  }
}
