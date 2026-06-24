import { TRPCError } from '@trpc/server'
import type { ILabelRepository, LabelRecord } from '../../../domain/repositories/ILabelRepository.js'
import type { IBoardRepository } from '../../../domain/repositories/IBoardRepository.js'

export class ListLabelsUseCase {
  private readonly boards: IBoardRepository
  private readonly labels: ILabelRepository

  constructor(boards: IBoardRepository, labels: ILabelRepository) {
    this.boards = boards
    this.labels = labels
  }

  async execute(userId: string, boardId: string): Promise<LabelRecord[]> {
    const board = await this.boards.findById(boardId)
    if (!board || board.userId !== userId) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Board not found' })
    }
    return this.labels.listByBoard(boardId)
  }
}

export class CreateLabelUseCase {
  private readonly boards: IBoardRepository
  private readonly labels: ILabelRepository

  constructor(boards: IBoardRepository, labels: ILabelRepository) {
    this.boards = boards
    this.labels = labels
  }

  async execute(userId: string, boardId: string, name: string, color: string): Promise<LabelRecord> {
    const board = await this.boards.findById(boardId)
    if (!board || board.userId !== userId) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Board not found' })
    }
    return this.labels.create(userId, boardId, name, color)
  }
}

export class UpdateLabelUseCase {
  private readonly labels: ILabelRepository

  constructor(labels: ILabelRepository) {
    this.labels = labels
  }

  async execute(userId: string, id: string, data: { name?: string; color?: string }): Promise<LabelRecord> {
    const label = await this.labels.findById(id)
    if (!label || label.userId !== userId) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Label not found' })
    }
    return this.labels.update(id, data)
  }
}

export class DeleteLabelUseCase {
  private readonly labels: ILabelRepository

  constructor(labels: ILabelRepository) {
    this.labels = labels
  }

  async execute(userId: string, id: string): Promise<void> {
    const label = await this.labels.findById(id)
    if (!label || label.userId !== userId) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Label not found' })
    }
    await this.labels.delete(id)
  }
}
