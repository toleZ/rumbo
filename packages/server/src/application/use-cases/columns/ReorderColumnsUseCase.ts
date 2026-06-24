import { TRPCError } from '@trpc/server'
import type { IColumnRepository } from '../../../domain/repositories/IColumnRepository.js'

export class ReorderColumnsUseCase {
  private readonly columns: IColumnRepository

  constructor(columns: IColumnRepository) {
    this.columns = columns
  }

  async execute(userId: string, columnIds: string[]): Promise<void> {
    const found = await Promise.all(columnIds.map((id) => this.columns.findById(id)))

    if (found.some((c) => !c)) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Some columns not found' })
    }

    for (const col of found) {
      if (col!.boardUserId !== userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' })
      }
    }

    await this.columns.reorder(columnIds)
  }
}
