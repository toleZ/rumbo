import type { FastifyReply } from 'fastify'
import type { IAuthRepository } from '../domain/repositories/IAuthRepository.js'
import { signRefreshToken } from './jwt.js'
import { env } from '../env.js'

export const COOKIE_OPTS_BASE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

export async function createRefreshSession(
  repo: IAuthRepository,
  res: FastifyReply,
  userId: string,
  rememberMe: boolean
): Promise<string> {
  const refreshToken = signRefreshToken(userId)
  const ttlMs = rememberMe
    ? env.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    : 24 * 60 * 60 * 1000

  await repo.deleteExpiredRefreshTokens(userId)
  await repo.createRefreshToken(refreshToken, userId, new Date(Date.now() + ttlMs), rememberMe)

  res.setCookie('refreshToken', refreshToken, {
    ...COOKIE_OPTS_BASE,
    ...(rememberMe ? { maxAge: env.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 } : {}),
  })

  return refreshToken
}

export async function clearRefreshSession(
  repo: IAuthRepository,
  res: FastifyReply,
  refreshToken: string | undefined
): Promise<void> {
  if (refreshToken) {
    await repo.deleteRefreshToken(refreshToken)
  }
  res.clearCookie('refreshToken', COOKIE_OPTS_BASE)
}
