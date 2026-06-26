import { NotFoundError } from '../../../domain/errors.js'
import type { ISubtaskRepository } from '../../../domain/repositories/ISubtaskRepository.js'
import type { ITaskRepository } from '../../../domain/repositories/ITaskRepository.js'
import type { Subtask } from '@rumbo/shared'

export class CreateSubtaskUseCase {
  private readonly tasks: ITaskRepository
  private readonly subtasks: ISubtaskRepository

  constructor(tasks: ITaskRepository, subtasks: ISubtaskRepository) {
    this.tasks = tasks
    this.subtasks = subtasks
  }

  async execute(userId: string, taskId: string, text: string): Promise<Subtask> {
    const task = await this.tasks.findById(taskId)
    if (!task || task.boardUserId !== userId) {
      throw new NotFoundError('Task not found')
    }
    return this.subtasks.create(taskId, text)
  }
}

export class UpdateSubtaskUseCase {
  private readonly subtasks: ISubtaskRepository

  constructor(subtasks: ISubtaskRepository) {
    this.subtasks = subtasks
  }

  async execute(userId: string, id: string, data: { text?: string; completed?: boolean }): Promise<Subtask> {
    const subtask = await this.subtasks.findById(id)
    if (!subtask || subtask.boardUserId !== userId) {
      throw new NotFoundError('Subtask not found')
    }
    return this.subtasks.update(id, data)
  }
}

export class DeleteSubtaskUseCase {
  private readonly subtasks: ISubtaskRepository

  constructor(subtasks: ISubtaskRepository) {
    this.subtasks = subtasks
  }

  async execute(userId: string, id: string): Promise<void> {
    const subtask = await this.subtasks.findById(id)
    if (!subtask || subtask.boardUserId !== userId) {
      throw new NotFoundError('Subtask not found')
    }
    await this.subtasks.delete(id)
  }
}
