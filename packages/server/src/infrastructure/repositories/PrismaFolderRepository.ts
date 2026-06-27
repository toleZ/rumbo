import type { PrismaClient } from '@prisma/client'
import type { IFolderRepository, FolderRecord } from '../../domain/repositories/IFolderRepository.js'

export class PrismaFolderRepository implements IFolderRepository {
  private readonly db: PrismaClient

  constructor(db: PrismaClient) {
    this.db = db
  }

  async listByUser(userId: string): Promise<FolderRecord[]> {
    const rows = await this.db.folder.findMany({
      where: { userId },
      orderBy: { order: 'asc' },
    })
    return rows.map(this.toFolder)
  }

  async findById(id: string): Promise<FolderRecord | null> {
    const row = await this.db.folder.findUnique({ where: { id } })
    if (!row) return null
    return this.toFolder(row)
  }

  async create(userId: string, name: string, parentId?: string | null): Promise<FolderRecord> {
    const row = await this.db.folder.create({
      data: { name, parentId: parentId ?? null, userId },
    })
    return this.toFolder(row)
  }

  async update(id: string, data: { name?: string; parentId?: string | null }): Promise<FolderRecord> {
    const row = await this.db.folder.update({ where: { id }, data })
    return this.toFolder(row)
  }

  async reorder(folderIds: string[], parentId: string | null): Promise<void> {
    await Promise.all(
      folderIds.map((id, index) =>
        this.db.folder.update({ where: { id }, data: { order: index } })
      )
    )
  }

  async deleteWithChildren(userId: string, id: string): Promise<void> {
    await this.db.note.updateMany({ where: { folderId: id }, data: { folderId: null } })
    await this.deleteChildren(userId, id)
    await this.db.folder.delete({ where: { id } })
  }

  private async deleteChildren(userId: string, parentId: string): Promise<void> {
    const children = await this.db.folder.findMany({ where: { parentId, userId } })
    for (const child of children) {
      await this.db.note.updateMany({ where: { folderId: child.id }, data: { folderId: null } })
      await this.deleteChildren(userId, child.id)
      await this.db.folder.delete({ where: { id: child.id } })
    }
  }

  private toFolder(row: { id: string; name: string; parentId: string | null; order: number; userId: string }): FolderRecord {
    return { id: row.id, name: row.name, parentId: row.parentId, order: row.order, userId: row.userId }
  }
}
