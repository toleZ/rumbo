import type { PrismaClient } from '@prisma/client'
import type { Note } from '@rumbo/shared'
import type {
  INoteRepository,
  NoteRecord,
  NoteSummary,
  CreateNoteInput,
  UpdateNoteInput,
} from '../../domain/repositories/INoteRepository.js'

export class PrismaNoteRepository implements INoteRepository {
  private readonly db: PrismaClient

  constructor(db: PrismaClient) {
    this.db = db
  }

  async listByUser(userId: string): Promise<NoteSummary[]> {
    const rows = await this.db.note.findMany({
      where: { userId },
      select: { id: true, title: true, folderId: true, order: true, createdAt: true, updatedAt: true, userId: true },
      orderBy: { order: 'asc' },
    })
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      folderId: r.folderId,
      order: r.order,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      userId: r.userId,
    }))
  }

  async findById(id: string): Promise<NoteRecord | null> {
    const row = await this.db.note.findUnique({ where: { id } })
    if (!row) return null
    return this.toNote(row)
  }

  async create(userId: string, data: CreateNoteInput): Promise<NoteRecord> {
    const row = await this.db.note.create({
      data: {
        title: data.title ?? 'Untitled',
        content: data.content ?? '',
        folderId: data.folderId ?? null,
        userId,
      },
    })
    return this.toNote(row)
  }

  async update(id: string, data: UpdateNoteInput): Promise<NoteRecord> {
    const row = await this.db.note.update({ where: { id }, data })
    return this.toNote(row)
  }

  async delete(id: string): Promise<void> {
    await this.db.note.delete({ where: { id } })
  }

  async reorder(noteIds: string[], folderId: string | null): Promise<void> {
    await Promise.all(
      noteIds.map((id, index) =>
        this.db.note.update({ where: { id }, data: { order: index } })
      )
    )
  }

  private toNote(row: {
    id: string
    title: string
    content: string
    folderId: string | null
    order?: number
    userId: string
    createdAt: Date
    updatedAt: Date
  }): NoteRecord {
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      folderId: row.folderId,
      order: row.order ?? 0,
      userId: row.userId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }
  }
}

// Re-export toNote shape helper for the domain Note type
export function noteToNote(row: { id: string; title: string; content: string; folderId: string | null; order?: number; createdAt: Date; updatedAt: Date }): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    folderId: row.folderId,
    order: row.order ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
