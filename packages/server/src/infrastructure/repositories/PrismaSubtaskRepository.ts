import type { PrismaClient } from '@prisma/client'
import type { Subtask } from '@rumbo/shared'
import type { ISubtaskRepository, SubtaskRecord } from '../../domain/repositories/ISubtaskRepository.js'

export class PrismaSubtaskRepository implements ISubtaskRepository {
  private readonly db: PrismaClient

  constructor(db: PrismaClient) {
    this.db = db
  }

  async findById(id: string): Promise<SubtaskRecord | null> {
    const row = await this.db.subtask.findUnique({
      where: { id },
      include: { task: { include: { board: { select: { userId: true } } } } },
    })
    if (!row) return null
    return {
      id: row.id,
      text: row.text,
      completed: row.completed,
      boardUserId: row.task.board.userId,
    }
  }

  async create(taskId: string, text: string): Promise<Subtask> {
    const row = await this.db.subtask.create({ data: { text, taskId } })
    return { id: row.id, text: row.text, completed: row.completed }
  }

  async update(id: string, data: { text?: string; completed?: boolean }): Promise<Subtask> {
    const row = await this.db.subtask.update({ where: { id }, data })
    return { id: row.id, text: row.text, completed: row.completed }
  }

  async delete(id: string): Promise<void> {
    await this.db.subtask.delete({ where: { id } })
  }
}
