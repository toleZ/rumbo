import type { IBoardRepository, CreateBoardInput, BoardWithColumns } from '../../../domain/repositories/IBoardRepository.js'

export class CreateBoardUseCase {
  private readonly boards: IBoardRepository

  constructor(boards: IBoardRepository) {
    this.boards = boards
  }

  execute(userId: string, data: CreateBoardInput): Promise<BoardWithColumns> {
    return this.boards.create(userId, data)
  }
}
