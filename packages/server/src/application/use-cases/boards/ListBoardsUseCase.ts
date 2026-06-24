import type { IBoardRepository } from '../../../domain/repositories/IBoardRepository.js'
import type { Board } from '@rumbo/shared'

export class ListBoardsUseCase {
  private readonly boards: IBoardRepository

  constructor(boards: IBoardRepository) {
    this.boards = boards
  }

  execute(userId: string): Promise<Board[]> {
    return this.boards.findAllByUser(userId)
  }
}
