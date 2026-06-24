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
}
