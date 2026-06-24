import type { PrismaClient } from '@prisma/client'
import type {
  IBetaRepository,
  BetaRequestRecord,
  CreateBetaRequestInput,
} from '../../domain/repositories/IBetaRepository.js'

export class PrismaBetaRepository implements IBetaRepository {
  private readonly db: PrismaClient

  constructor(db: PrismaClient) {
    this.db = db
  }

  findByEmail(email: string): Promise<BetaRequestRecord | null> {
    return this.db.betaRequest.findUnique({ where: { email } })
  }

  async create(data: CreateBetaRequestInput): Promise<void> {
    await this.db.betaRequest.create({
      data: { name: data.name, email: data.email, message: data.message ?? null },
    })
  }
}
