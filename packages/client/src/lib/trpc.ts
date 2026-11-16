import { createTRPCReact } from '@trpc/react-query'
import { createTRPCClient as createVanillaClient, httpBatchLink } from '@trpc/client'
import type { AppRouter } from '../../../server/src/router/index'
import { API_BASE } from './platform/apiBase'

export const trpc = createTRPCReact<AppRouter>()

// In dev, use the relative path so Vite's proxy handles the request (same-origin →
// cookies work with SameSite=lax). In production, VITE_API_URL must be set to the
// absolute API URL and the cookie domain/SameSite must be configured accordingly.
// API_BASE is empty on web, so this stays the literal '/trpc' it has always been; a
// native shell sets it because it has no dev proxy and its own origin.
const API_URL = import.meta.env.VITE_API_URL ?? `${API_BASE}/trpc`

const credentialsFetch = (url: RequestInfo | URL, options?: RequestInit) =>
  globalThis.fetch(url, { ...(options ?? {}), credentials: 'include' })

// Standalone vanilla client for the startup silent refresh — avoids React/QueryClient
// dependency and uses the correct tRPC batch protocol (same as httpBatchLink).
const _vanillaClient = createVanillaClient<AppRouter>({
  links: [httpBatchLink({ url: API_URL, fetch: credentialsFetch })],
})

// Fire-and-forget: cleans up the server-side refresh token + clears the httpOnly cookie.
// Used on startup when we detect a new browser session with rememberMe=false.
export async function logoutServer(): Promise<void> {
  try {
    await _vanillaClient.auth.logout.mutate()
  } catch {}
}

// Refresh lock: if multiple 401s fire simultaneously, only one call hits the server.
// All concurrent callers await the same Promise so token rotation doesn't race.
let _refreshPromise: Promise<string | null> | null = null

export async function refreshAccessToken(): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise

  _refreshPromise = (async () => {
    try {
      const data = await _vanillaClient.auth.refresh.mutate()
      if (data.accessToken) return data.accessToken
    } catch {}
    return null
  })().finally(() => {
    _refreshPromise = null
  })

  return _refreshPromise
}

interface TRPCClientConfig {
  getToken: () => string | null
  onNewToken: (token: string) => void
  onSessionExpired: () => void
}

export function createTRPCClient(config: TRPCClientConfig) {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: API_URL,
        async headers() {
          const token = config.getToken()
          return token ? { Authorization: `Bearer ${token}` } : {}
        },
        async fetch(url, options) {
          let res = await credentialsFetch(url, options as RequestInit)
          if (res.status === 401) {
            const newToken = await refreshAccessToken()
            if (newToken) {
              config.onNewToken(newToken)
              res = await credentialsFetch(url, {
                ...(options as RequestInit),
                headers: {
                  ...((options as RequestInit)?.headers ?? {}),
                  Authorization: `Bearer ${newToken}`,
                },
              })
            } else {
              config.onSessionExpired()
              // Return a well-formed tRPC error response so httpBatchLink can
              // parse it without throwing "Unexpected end of JSON input".
              return new Response(
                JSON.stringify([{ error: { message: 'UNAUTHORIZED', code: -32001, data: { code: 'UNAUTHORIZED', httpStatus: 401 } } }]),
                { status: 401, headers: { 'content-type': 'application/json' } },
              )
            }
          }
          return res
        },
      }),
    ],
  })
}

// Fire-and-forget mutation that survives the page being torn down (tab close,
// navigation away, mobile backgrounding). httpBatchLink's fetch is cancelled on unload,
// so this posts the single-procedure tRPC wire format directly with `keepalive`.
// No transformer is configured on the server, so the body is the raw JSON input.
// Best-effort by design: no 401 → refresh retry (there is no page left to retry from).
// Browsers cap keepalive bodies at 64KB; above that we still try, without the flag.
const KEEPALIVE_MAX_BYTES = 60_000

export function sendKeepaliveMutation(path: string, input: unknown, token: string | null): void {
  const body = JSON.stringify(input)
  try {
    void credentialsFetch(`${API_URL}/${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
      keepalive: new Blob([body]).size <= KEEPALIVE_MAX_BYTES,
    }).catch(() => {})
  } catch {
    // Some browsers throw synchronously on keepalive during unload; nothing left to do.
  }
}
