// Required secrets must always be provided via the environment. A dev fallback
// is only used when NODE_ENV is *explicitly* 'development' — any other value
// (production, staging, prod, or unset) throws, so we never silently boot with a
// guessable secret.
function secret(name: string, devFallback: string): string {
  const value = process.env[name]
  if (value) return value
  if (process.env.NODE_ENV === 'development') return devFallback
  throw new Error(`Missing required environment variable: ${name}`)
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback
}

export const env = {
  DATABASE_URL: optional('DATABASE_URL', 'postgresql://rumbo:rumbo@localhost:5432/rumbo'),
  JWT_SECRET: secret('JWT_SECRET', 'dev-secret-change-in-production'),
  JWT_REFRESH_SECRET: secret('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-in-production'),
  ACCESS_TOKEN_EXPIRY: '15m',
  REFRESH_TOKEN_EXPIRY_DAYS: 7,
  SMTP_HOST: optional('SMTP_HOST', 'localhost'),
  SMTP_PORT: Number(optional('SMTP_PORT', '1025')),
  SMTP_USER: optional('SMTP_USER', ''),
  SMTP_PASS: optional('SMTP_PASS', ''),
  PORT: Number(optional('PORT', '4000')),
  CLIENT_URL: optional('CLIENT_URL', 'http://localhost:5173'),
  ADMIN_EMAIL: optional('ADMIN_EMAIL', ''),
  OPENROUTER_API_KEY: optional('OPENROUTER_API_KEY', ''),
  OPENROUTER_MODEL: optional('OPENROUTER_MODEL', 'openrouter/owl-alpha'),
  // Used once as a retry target if the primary model request fails (e.g. the
  // free "alpha" model is rate-limited or removed). Empty = no fallback.
  OPENROUTER_FALLBACK_MODEL: optional('OPENROUTER_FALLBACK_MODEL', ''),
  // 32-byte base64 key used to encrypt third-party OAuth tokens (Connection model) at
  // rest. Must be set in prod like the JWT secrets — generate with `openssl rand -base64 32`.
  CONNECTION_ENC_KEY: secret('CONNECTION_ENC_KEY', 'MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE='),
  // Third-party connections (Settings > Connections). Empty client id/secret keeps the
  // feature inert — the authorize route 404s rather than starting a broken OAuth flow.
  SPOTIFY_CLIENT_ID: optional('SPOTIFY_CLIENT_ID', ''),
  SPOTIFY_CLIENT_SECRET: optional('SPOTIFY_CLIENT_SECRET', ''),
  // Spotify rejects `localhost` as a redirect URI (loopback callbacks must use the
  // literal IP per RFC 8252) — use 127.0.0.1, and make sure CLIENT_URL and the
  // browser's address bar use 127.0.0.1 too, since the OAuth CSRF cookie is scoped
  // to whichever hostname the browser was on when /authorize was hit.
  SPOTIFY_REDIRECT_URI: optional('SPOTIFY_REDIRECT_URI', 'http://127.0.0.1:4000/api/connections/spotify/callback'),
}
