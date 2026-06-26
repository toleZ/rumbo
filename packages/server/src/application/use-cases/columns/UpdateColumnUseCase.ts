import { NotFoundError } from '../../../domain/errors.js'
import type { IColumnRepository, UpdateColumnInput } from '../../../domain/repositories/IColumnRepository.js'
import type { Column } from '@rumbo/shared'

export class UpdateColumnUseCase {
  private readonly columns: IColumnRepository

  constructor(columns: IColumnRepository) {
    this.columns = columns
  }

  async execute(userId: string, id: string, data: UpdateColumnInput): Promise<Column> {
    const column = await this.columns.findById(id)
    if (!column || column.boardUserId !== userId) {
      throw new NotFoundError('Column not found')
    }
    return this.columns.update(id, data)
  }
}
