import { NotFoundError } from '../../../domain/errors.js'
import type { IColumnRepository } from '../../../domain/repositories/IColumnRepository.js'

export class DeleteColumnUseCase {
  private readonly columns: IColumnRepository

  constructor(columns: IColumnRepository) {
    this.columns = columns
  }

  async execute(userId: string, id: string): Promise<void> {
    const column = await this.columns.findById(id)
    if (!column || column.boardUserId !== userId) {
      throw new NotFoundError('Column not found')
    }
    await this.columns.delete(id)
  }
}
