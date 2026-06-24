import { TRPCError } from '@trpc/server'
import type { IBoardRepository, UpdateBoardInput } from '../../../domain/repositories/IBoardRepository.js'
import type { Board } from '@rumbo/shared'

export class UpdateBoardUseCase {
  private readonly boards: IBoardRepository

  constructor(boards: IBoardRepository) {
    this.boards = boards
  }

  async execute(userId: string, id: string, data: UpdateBoardInput): Promise<Board> {
    const board = await this.boards.findById(id)
    if (!board || board.userId !== userId) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Board not found' })
    }
    return this.boards.update(id, data)
  }
}
