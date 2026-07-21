import type { PrismaClient } from '@prisma/client'
import type {
  IConnectionRepository,
  ConnectionRecord,
  UpsertConnectionInput,
} from '../../domain/repositories/IConnectionRepository.js'

export class PrismaConnectionRepository implements IConnectionRepository {
  private readonly db: PrismaClient

  constructor(db: PrismaClient) {
    this.db = db
  }

  findByUserAndProvider(userId: string, provider: string): Promise<ConnectionRecord | null> {
    return this.db.connection.findUnique({ where: { userId_provider: { userId, provider } } })
  }

  upsert(data: UpsertConnectionInput): Promise<ConnectionRecord> {
    const { userId, provider, ...rest } = data
    return this.db.connection.upsert({
      where: { userId_provider: { userId, provider } },
      create: { userId, provider, ...rest },
      update: { ...rest },
    })
  }

  async deleteByUserAndProvider(userId: string, provider: string): Promise<void> {
    await this.db.connection.deleteMany({ where: { userId, provider } })
  }

  listByUser(userId: string): Promise<ConnectionRecord[]> {
    return this.db.connection.findMany({ where: { userId } })
  }
}
