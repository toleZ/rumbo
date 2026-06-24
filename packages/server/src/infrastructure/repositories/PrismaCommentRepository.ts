import type { PrismaClient } from '@prisma/client'
import type { Comment } from '@rumbo/shared'
import type { ICommentRepository, CommentRecord } from '../../domain/repositories/ICommentRepository.js'

export class PrismaCommentRepository implements ICommentRepository {
  private readonly db: PrismaClient

  constructor(db: PrismaClient) {
    this.db = db
  }

  async findById(id: string): Promise<CommentRecord | null> {
    const row = await this.db.comment.findUnique({
      where: { id },
      include: { task: { include: { board: { select: { userId: true } } } } },
    })
    if (!row) return null
    return {
      id: row.id,
      taskId: row.taskId,
      text: row.text,
      createdAt: row.createdAt.toISOString(),
      boardUserId: row.task.board.userId,
    }
  }

  async listByTask(taskId: string): Promise<Comment[]> {
    const rows = await this.db.comment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
    })
    return rows.map((r) => ({ id: r.id, taskId: r.taskId, text: r.text, createdAt: r.createdAt.toISOString() }))
  }

  async create(taskId: string, text: string): Promise<Comment> {
    const row = await this.db.comment.create({ data: { text, taskId } })
    return { id: row.id, taskId: row.taskId, text: row.text, createdAt: row.createdAt.toISOString() }
  }

  async delete(id: string): Promise<void> {
    await this.db.comment.delete({ where: { id } })
  }
}
