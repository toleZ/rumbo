import { NotFoundError, BadRequestError } from '../../../domain/errors.js'
import type { IBoardRepository } from '../../../domain/repositories/IBoardRepository.js'

export class DeleteBoardUseCase {
  private readonly boards: IBoardRepository

  constructor(boards: IBoardRepository) {
    this.boards = boards
  }

  async execute(userId: string, id: string): Promise<void> {
    const board = await this.boards.findById(id)
    if (!board || board.userId !== userId) {
      throw new NotFoundError('Board not found')
    }

    const count = await this.boards.countByUser(userId)
    if (count <= 1) {
      throw new BadRequestError('Cannot delete the last board')
    }

    await this.boards.delete(id)
  }
}
