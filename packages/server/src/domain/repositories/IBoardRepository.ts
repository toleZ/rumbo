import type { Board, Column } from '@rumbo/shared'

export type BoardRecord = Board & { userId: string }

export interface BoardWithColumns extends Board {
  columns: Column[]
}

export interface CreateBoardInput {
  name: string
  color?: string | null
  columnTitles?: string[]
}

export interface UpdateBoardInput {
  name?: string
  color?: string | null
  order?: number
}

export interface IBoardRepository {
  findAllByUser(userId: string): Promise<Board[]>
  findById(id: string): Promise<BoardRecord | null>
  countByUser(userId: string): Promise<number>
  create(userId: string, data: CreateBoardInput): Promise<BoardWithColumns>
  update(id: string, data: UpdateBoardInput): Promise<Board>
  delete(id: string): Promise<void>
}
