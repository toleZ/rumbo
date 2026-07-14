import type { PrismaClient } from '@prisma/client'
import type { ILabelRepository, LabelRecord } from '../../domain/repositories/ILabelRepository.js'

export class PrismaLabelRepository implements ILabelRepository {
  private readonly db: PrismaClient

  constructor(db: PrismaClient) {
    this.db = db
  }

  async findById(id: string): Promise<LabelRecord | null> {
    const row = await this.db.label.findUnique({ where: { id } })
    if (!row) return null
    return { id: row.id, name: row.name, color: row.color, userId: row.userId, boardId: row.boardId }
  }

  async findAllByUser(userId: string): Promise<LabelRecord[]> {
    const rows = await this.db.label.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    })
    return rows.map((r) => ({ id: r.id, name: r.name, color: r.color, userId: r.userId, boardId: r.boardId }))
  }

  async listByBoard(boardId: string): Promise<LabelRecord[]> {
    const rows = await this.db.label.findMany({
      where: { boardId },
      orderBy: { name: 'asc' },
    })
    return rows.map((r) => ({ id: r.id, name: r.name, color: r.color, userId: r.userId, boardId: r.boardId }))
  }

  async create(userId: string, boardId: string, name: string, color: string): Promise<LabelRecord> {
    const row = await this.db.label.create({ data: { name, color, userId, boardId } })
    return { id: row.id, name: row.name, color: row.color, userId: row.userId, boardId: row.boardId }
  }

  async update(id: string, data: { name?: string; color?: string }): Promise<LabelRecord> {
    const row = await this.db.label.update({ where: { id }, data })
    return { id: row.id, name: row.name, color: row.color, userId: row.userId, boardId: row.boardId }
  }

  async delete(id: string): Promise<void> {
    await this.db.label.delete({ where: { id } })
  }
}
