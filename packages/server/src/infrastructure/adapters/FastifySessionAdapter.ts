import type { FastifyReply } from 'fastify'
import type { IAuthRepository } from '../../domain/repositories/IAuthRepository.js'
import type { ISessionPort } from '../../application/ports/ISessionPort.js'
import { createRefreshSession, clearRefreshSession } from '../../auth/session.js'

export class FastifySessionAdapter implements ISessionPort {
  private readonly repo: IAuthRepository
  private readonly res: FastifyReply

  constructor(repo: IAuthRepository, res: FastifyReply) {
    this.repo = repo
    this.res = res
  }

  async create(userId: string, rememberMe: boolean): Promise<void> {
    await createRefreshSession(this.repo, this.res, userId, rememberMe)
  }

  async clear(token?: string): Promise<void> {
    await clearRefreshSession(this.repo, this.res, token)
  }
}
