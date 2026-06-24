export interface UserRecord {
  id: string
  email: string
  password: string
  name: string | null
  emailVerified: boolean
  createdAt: Date
}

export interface VerificationCodeRecord {
  id: string
  userId: string
  code: string
  type: string
  expiresAt: Date
  used: boolean
  attempts: number
}

export interface RefreshTokenRecord {
  id: string
  token: string
  userId: string
  expiresAt: Date
  rememberMe: boolean
}

export interface CreateUserInput {
  email: string
  password: string
  name?: string | null
}

export interface IAuthRepository {
  findUserByEmail(email: string): Promise<UserRecord | null>
  createUser(data: CreateUserInput): Promise<UserRecord>
  updateUserEmailVerified(userId: string, verified: boolean): Promise<void>
  updateUserPassword(userId: string, hashedPassword: string): Promise<void>
  createVerificationCode(userId: string, type: string, code: string, expiresAt: Date): Promise<void>
  invalidateVerificationCodes(userId: string, type: string): Promise<void>
  findActiveVerificationCode(userId: string, type: string): Promise<VerificationCodeRecord | null>
  incrementVerificationAttempts(id: string, markUsed: boolean): Promise<void>
  markVerificationCodeUsed(id: string): Promise<void>
  findRefreshToken(token: string): Promise<RefreshTokenRecord | null>
  createRefreshToken(token: string, userId: string, expiresAt: Date, rememberMe: boolean): Promise<void>
  deleteExpiredRefreshTokens(userId: string): Promise<void>
  deleteRefreshToken(token: string): Promise<void>
  deleteAllRefreshTokensForUser(userId: string): Promise<void>
}
