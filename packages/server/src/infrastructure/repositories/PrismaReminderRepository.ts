import type { PrismaClient } from '@prisma/client'
import type { Reminder } from '@rumbo/shared'
import type {
  IReminderRepository,
  ReminderRecord,
  ReminderWithTaskTitle,
} from '../../domain/repositories/IReminderRepository.js'

export class PrismaReminderRepository implements IReminderRepository {
  private readonly db: PrismaClient

  constructor(db: PrismaClient) {
    this.db = db
  }

  async findById(id: string): Promise<ReminderRecord | null> {
    const row = await this.db.reminder.findUnique({
      where: { id },
      include: { task: { include: { board: { select: { userId: true } } } } },
    })
    if (!row) return null
    return {
      id: row.id,
      taskId: row.taskId,
      remindAt: row.remindAt.toISOString(),
      notifiedAt: row.notifiedAt ? row.notifiedAt.toISOString() : null,
      boardUserId: row.task.board.userId,
    }
  }

  async listAllByUser(userId: string): Promise<ReminderWithTaskTitle[]> {
    const rows = await this.db.reminder.findMany({
      where: { task: { board: { userId } } },
      include: { task: { select: { title: true, boardId: true } } },
      orderBy: { remindAt: 'asc' },
    })
    return rows.map((r) => ({
      id: r.id,
      taskId: r.taskId,
      remindAt: r.remindAt.toISOString(),
      notifiedAt: r.notifiedAt ? r.notifiedAt.toISOString() : null,
      taskTitle: r.task.title,
      boardId: r.task.boardId,
    }))
  }

  async markNotified(id: string): Promise<Reminder> {
    const row = await this.db.reminder.update({ where: { id }, data: { notifiedAt: new Date() } })
    return {
      id: row.id,
      taskId: row.taskId,
      remindAt: row.remindAt.toISOString(),
      notifiedAt: row.notifiedAt ? row.notifiedAt.toISOString() : null,
    }
  }

  async create(taskId: string, remindAt: string): Promise<Reminder> {
    const row = await this.db.reminder.create({ data: { taskId, remindAt: new Date(remindAt) } })
    return {
      id: row.id,
      taskId: row.taskId,
      remindAt: row.remindAt.toISOString(),
      notifiedAt: row.notifiedAt ? row.notifiedAt.toISOString() : null,
    }
  }

  async update(id: string, remindAt: string): Promise<Reminder> {
    const row = await this.db.reminder.update({ where: { id }, data: { remindAt: new Date(remindAt) } })
    return {
      id: row.id,
      taskId: row.taskId,
      remindAt: row.remindAt.toISOString(),
      notifiedAt: row.notifiedAt ? row.notifiedAt.toISOString() : null,
    }
  }

  async delete(id: string): Promise<void> {
    await this.db.reminder.delete({ where: { id } })
  }
}
