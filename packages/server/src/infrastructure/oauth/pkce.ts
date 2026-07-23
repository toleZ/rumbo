import { randomBytes, createHash } from 'node:crypto'

// PKCE (RFC 7636) + OAuth `state` helpers, shared by every provider's authorization-code
// flow (Spotify, Google Calendar, ...) — provider-agnostic, so it lives outside any
// single provider's directory.
function base64url(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function generateState(): string {
  return base64url(randomBytes(16))
}

export function generateCodeVerifier(): string {
  return base64url(randomBytes(32))
}

export function codeChallengeFromVerifier(verifier: string): string {
  return base64url(createHash('sha256').update(verifier).digest())
}
