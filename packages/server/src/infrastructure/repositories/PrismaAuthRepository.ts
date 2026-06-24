import type { PrismaClient } from '@prisma/client'
import type {
  IAuthRepository,
  UserRecord,
  VerificationCodeRecord,
  RefreshTokenRecord,
  CreateUserInput,
} from '../../domain/repositories/IAuthRepository.js'

export class PrismaAuthRepository implements IAuthRepository {
  private readonly db: PrismaClient

  constructor(db: PrismaClient) {
    this.db = db
  }

  findUserByEmail(email: string): Promise<UserRecord | null> {
    return this.db.user.findUnique({ where: { email } })
  }

  createUser(data: CreateUserInput): Promise<UserRecord> {
    return this.db.user.create({
      data: { email: data.email, password: data.password, name: data.name ?? null },
    })
  }

  async updateUserEmailVerified(userId: string, verified: boolean): Promise<void> {
    await this.db.user.update({ where: { id: userId }, data: { emailVerified: verified } })
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
    await this.db.user.update({ where: { id: userId }, data: { password: hashedPassword } })
  }

  async createVerificationCode(userId: string, type: string, code: string, expiresAt: Date): Promise<void> {
    await this.db.verificationCode.create({ data: { userId, type, code, expiresAt } })
  }

  async invalidateVerificationCodes(userId: string, type: string): Promise<void> {
    await this.db.verificationCode.updateMany({
      where: { userId, type, used: false },
      data: { used: true },
    })
  }

  findActiveVerificationCode(userId: string, type: string): Promise<VerificationCodeRecord | null> {
    return this.db.verificationCode.findFirst({
      where: { userId, type, used: false, expiresAt: { gt: new Date() } },
    })
  }

  async incrementVerificationAttempts(id: string, markUsed: boolean): Promise<void> {
    await this.db.verificationCode.update({
      where: { id },
      data: { attempts: { increment: 1 }, ...(markUsed ? { used: true } : {}) },
    })
  }

  async markVerificationCodeUsed(id: string): Promise<void> {
    await this.db.verificationCode.update({ where: { id }, data: { used: true } })
  }

  findRefreshToken(token: string): Promise<RefreshTokenRecord | null> {
    return this.db.refreshToken.findUnique({ where: { token } })
  }

  async createRefreshToken(token: string, userId: string, expiresAt: Date, rememberMe: boolean): Promise<void> {
    await this.db.refreshToken.create({ data: { token, userId, expiresAt, rememberMe } })
  }

  async deleteExpiredRefreshTokens(userId: string): Promise<void> {
    await this.db.refreshToken.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } })
  }

  async deleteRefreshToken(token: string): Promise<void> {
    await this.db.refreshToken.deleteMany({ where: { token } })
  }

  async deleteAllRefreshTokensForUser(userId: string): Promise<void> {
    await this.db.refreshToken.deleteMany({ where: { userId } })
  }
}
