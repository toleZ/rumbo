import { NotFoundError } from '../../../domain/errors.js'
import type { ICommentRepository } from '../../../domain/repositories/ICommentRepository.js'
import type { ITaskRepository } from '../../../domain/repositories/ITaskRepository.js'
import type { Comment } from '@rumbo/shared'

export class ListCommentsUseCase {
  private readonly tasks: ITaskRepository
  private readonly comments: ICommentRepository

  constructor(tasks: ITaskRepository, comments: ICommentRepository) {
    this.tasks = tasks
    this.comments = comments
  }

  async execute(userId: string, taskId: string): Promise<Comment[]> {
    const task = await this.tasks.findById(taskId)
    if (!task || task.boardUserId !== userId) {
      throw new NotFoundError('Task not found')
    }
    return this.comments.listByTask(taskId)
  }
}

export class CreateCommentUseCase {
  private readonly tasks: ITaskRepository
  private readonly comments: ICommentRepository

  constructor(tasks: ITaskRepository, comments: ICommentRepository) {
    this.tasks = tasks
    this.comments = comments
  }

  async execute(userId: string, taskId: string, text: string): Promise<Comment> {
    const task = await this.tasks.findById(taskId)
    if (!task || task.boardUserId !== userId) {
      throw new NotFoundError('Task not found')
    }
    return this.comments.create(taskId, text)
  }
}

export class DeleteCommentUseCase {
  private readonly comments: ICommentRepository

  constructor(comments: ICommentRepository) {
    this.comments = comments
  }

  async execute(userId: string, id: string): Promise<void> {
    const comment = await this.comments.findById(id)
    if (!comment || comment.boardUserId !== userId) {
      throw new NotFoundError('Comment not found')
    }
    await this.comments.delete(id)
  }
}
