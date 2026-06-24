import { TRPCError } from '@trpc/server'
import type { IBoardRepository } from '../../../domain/repositories/IBoardRepository.js'
import type { IColumnRepository } from '../../../domain/repositories/IColumnRepository.js'
import type { Column } from '@rumbo/shared'

export class CreateColumnUseCase {
  private readonly boards: IBoardRepository
  private readonly columns: IColumnRepository

  constructor(boards: IBoardRepository, columns: IColumnRepository) {
    this.boards = boards
    this.columns = columns
  }

  async execute(userId: string, title: string, boardId: string): Promise<Column> {
    const board = await this.boards.findById(boardId)
    if (!board || board.userId !== userId) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Board not found' })
    }

    const order = await this.columns.countByBoard(boardId)
    return this.columns.create({ title, boardId, order })
  }
}
