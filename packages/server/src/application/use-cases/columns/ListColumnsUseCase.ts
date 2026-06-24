import { TRPCError } from '@trpc/server'
import type { IBoardRepository } from '../../../domain/repositories/IBoardRepository.js'
import type { IColumnRepository } from '../../../domain/repositories/IColumnRepository.js'
import type { Column } from '@rumbo/shared'

export class ListAllColumnsUseCase {
  private readonly columns: IColumnRepository

  constructor(columns: IColumnRepository) {
    this.columns = columns
  }

  execute(userId: string): Promise<Column[]> {
    return this.columns.findAllByUser(userId)
  }
}

export class ListBoardColumnsUseCase {
  private readonly boards: IBoardRepository
  private readonly columns: IColumnRepository

  constructor(boards: IBoardRepository, columns: IColumnRepository) {
    this.boards = boards
    this.columns = columns
  }

  async execute(userId: string, boardId: string): Promise<Column[]> {
    const board = await this.boards.findById(boardId)
    if (!board || board.userId !== userId) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Board not found' })
    }
    return this.columns.findByBoard(boardId)
  }
}
