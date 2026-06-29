import type { PrismaClient } from '@prisma/client'
import type { IChatRepository, ChatMessageRecord } from '../../domain/repositories/IChatRepository.js'

export class PrismaChatRepository implements IChatRepository {
  private readonly db: PrismaClient

  constructor(db: PrismaClient) {
    this.db = db
  }

  async getHistory(userId: string, limit: number): Promise<ChatMessageRecord[]> {
    // Fetch the most recent `limit` messages, then return them chronologically.
    // (Ordering ascending + take returns the OLDEST N — which starves the model
    // of recent context as the conversation grows.) The `id` tiebreaker keeps a
    // stable order when a user+assistant pair share a createdAt timestamp.
    const rows = await this.db.chatMessage.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    })
    rows.reverse()
    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      role: r.role as 'user' | 'assistant',
      content: r.content,
      createdAt: r.createdAt.toISOString(),
    }))
  }

  async saveMessage(userId: string, role: 'user' | 'assistant', content: string): Promise<ChatMessageRecord> {
    const row = await this.db.chatMessage.create({
      data: { userId, role, content },
    })
    return {
      id: row.id,
      userId: row.userId,
      role: row.role as 'user' | 'assistant',
      content: row.content,
      createdAt: row.createdAt.toISOString(),
    }
  }

  async clearHistory(userId: string): Promise<void> {
    await this.db.chatMessage.deleteMany({ where: { userId } })
  }
}
