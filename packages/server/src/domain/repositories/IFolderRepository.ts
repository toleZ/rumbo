import type { Folder } from '@rumbo/shared'

export type FolderRecord = Folder & { userId: string }

export interface IFolderRepository {
  listByUser(userId: string): Promise<FolderRecord[]>
  findById(id: string): Promise<FolderRecord | null>
  create(userId: string, name: string, parentId?: string | null): Promise<FolderRecord>
  update(id: string, data: { name?: string; parentId?: string | null }): Promise<FolderRecord>
  deleteWithChildren(userId: string, id: string): Promise<void>
}
