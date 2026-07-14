import type { Label } from '@rumbo/shared'

export type LabelRecord = Label & { userId: string; boardId: string }

export interface ILabelRepository {
  findById(id: string): Promise<LabelRecord | null>
  findAllByUser(userId: string): Promise<LabelRecord[]>
  listByBoard(boardId: string): Promise<LabelRecord[]>
  create(userId: string, boardId: string, name: string, color: string): Promise<LabelRecord>
  update(id: string, data: { name?: string; color?: string }): Promise<LabelRecord>
  delete(id: string): Promise<void>
}
