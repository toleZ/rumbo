import type { Column } from '@rumbo/shared'

export type ColumnRecord = Column & { boardUserId: string }

export interface CreateColumnInput {
  title: string
  boardId: string
}

export interface UpdateColumnInput {
  title?: string
  order?: number
  isDone?: boolean
}

export interface IColumnRepository {
  findAllByUser(userId: string): Promise<Column[]>
  findByBoard(boardId: string): Promise<Column[]>
  findById(id: string): Promise<ColumnRecord | null>
  countByBoard(boardId: string): Promise<number>
  create(data: CreateColumnInput & { order: number }): Promise<Column>
  update(id: string, data: UpdateColumnInput): Promise<Column>
  delete(id: string): Promise<void>
  reorder(columnIds: string[]): Promise<void>
}
