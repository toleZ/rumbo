import { TRPCError } from '@trpc/server'
import type { IFolderRepository, FolderRecord } from '../../../domain/repositories/IFolderRepository.js'

export class ListFoldersUseCase {
  private readonly folders: IFolderRepository

  constructor(folders: IFolderRepository) {
    this.folders = folders
  }

  execute(userId: string): Promise<FolderRecord[]> {
    return this.folders.listByUser(userId)
  }
}

export class CreateFolderUseCase {
  private readonly folders: IFolderRepository

  constructor(folders: IFolderRepository) {
    this.folders = folders
  }

  execute(userId: string, name: string, parentId?: string | null): Promise<FolderRecord> {
    return this.folders.create(userId, name, parentId)
  }
}

export class UpdateFolderUseCase {
  private readonly folders: IFolderRepository

  constructor(folders: IFolderRepository) {
    this.folders = folders
  }

  async execute(userId: string, id: string, data: { name?: string; parentId?: string | null }): Promise<FolderRecord> {
    const folder = await this.folders.findById(id)
    if (!folder || folder.userId !== userId) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Folder not found' })
    }
    return this.folders.update(id, data)
  }
}

export class DeleteFolderUseCase {
  private readonly folders: IFolderRepository

  constructor(folders: IFolderRepository) {
    this.folders = folders
  }

  async execute(userId: string, id: string): Promise<void> {
    const folder = await this.folders.findById(id)
    if (!folder || folder.userId !== userId) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Folder not found' })
    }
    await this.folders.deleteWithChildren(userId, id)
  }
}
