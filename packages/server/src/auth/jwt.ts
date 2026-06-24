import jwt from 'jsonwebtoken'
import { env } from '../env.js'

export interface TokenPayload {
  userId: string
}

export function signAccessToken(userId: string): string {
  return jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: env.ACCESS_TOKEN_EXPIRY } as jwt.SignOptions)
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ userId }, env.JWT_REFRESH_SECRET, { expiresIn: `${env.REFRESH_TOKEN_EXPIRY_DAYS}d` } as jwt.SignOptions)
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload
}
