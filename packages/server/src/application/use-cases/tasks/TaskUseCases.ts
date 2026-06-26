import { NotFoundError, ForbiddenError } from '../../../domain/errors.js'
import type { ITaskRepository, CreateTaskInput, UpdateTaskInput } from '../../../domain/repositories/ITaskRepository.js'
import type { IBoardRepository } from '../../../domain/repositories/IBoardRepository.js'
import type { IColumnRepository } from '../../../domain/repositories/IColumnRepository.js'
import type { Task, Comment } from '@rumbo/shared'

export class ListAllTasksUseCase {
  private readonly tasks: ITaskRepository

  constructor(tasks: ITaskRepository) {
    this.tasks = tasks
  }

  execute(userId: string): Promise<Task[]> {
    return this.tasks.findAllByUser(userId)
  }
}

export class ListBoardTasksUseCase {
  private readonly boards: IBoardRepository
  private readonly tasks: ITaskRepository

  constructor(boards: IBoardRepository, tasks: ITaskRepository) {
    this.boards = boards
    this.tasks = tasks
  }

  async execute(userId: string, boardId: string): Promise<Task[]> {
    const board = await this.boards.findById(boardId)
    if (!board || board.userId !== userId) {
      throw new NotFoundError('Board not found')
    }
    return this.tasks.findByBoard(boardId)
  }
}

export class CreateTaskUseCase {
  private readonly boards: IBoardRepository
  private readonly tasks: ITaskRepository

  constructor(boards: IBoardRepository, tasks: ITaskRepository) {
    this.boards = boards
    this.tasks = tasks
  }

  async execute(userId: string, data: CreateTaskInput): Promise<Task> {
    const board = await this.boards.findById(data.boardId)
    if (!board || board.userId !== userId) {
      throw new NotFoundError('Board not found')
    }
    return this.tasks.create(data)
  }
}

export class UpdateTaskUseCase {
  private readonly tasks: ITaskRepository

  constructor(tasks: ITaskRepository) {
    this.tasks = tasks
  }

  async execute(userId: string, id: string, data: UpdateTaskInput): Promise<Task> {
    const task = await this.tasks.findById(id)
    if (!task || task.boardUserId !== userId) {
      throw new NotFoundError('Task not found')
    }
    return this.tasks.update(id, data)
  }
}

export class DeleteTaskUseCase {
  private readonly tasks: ITaskRepository

  constructor(tasks: ITaskRepository) {
    this.tasks = tasks
  }

  async execute(userId: string, id: string): Promise<void> {
    const task = await this.tasks.findById(id)
    if (!task || task.boardUserId !== userId) {
      throw new NotFoundError('Task not found')
    }
    await this.tasks.delete(id)
  }
}

export class MoveTaskUseCase {
  private readonly tasks: ITaskRepository
  private readonly columns: IColumnRepository

  constructor(tasks: ITaskRepository, columns: IColumnRepository) {
    this.tasks = tasks
    this.columns = columns
  }

  async execute(userId: string, taskId: string, columnId: string, order: number): Promise<Task> {
    const task = await this.tasks.findById(taskId)
    if (!task || task.boardUserId !== userId) {
      throw new NotFoundError('Task not found')
    }
    const destColumn = await this.columns.findById(columnId)
    if (!destColumn || destColumn.boardUserId !== userId) {
      throw new ForbiddenError('Access denied')
    }
    return this.tasks.move(taskId, columnId, order)
  }
}

export class ReorderTasksUseCase {
  private readonly columns: IColumnRepository
  private readonly tasks: ITaskRepository

  constructor(columns: IColumnRepository, tasks: ITaskRepository) {
    this.columns = columns
    this.tasks = tasks
  }

  async execute(userId: string, columnId: string, taskIds: string[]): Promise<void> {
    const column = await this.columns.findById(columnId)
    if (!column || column.boardUserId !== userId) {
      throw new NotFoundError('Column not found')
    }
    const tasks = await this.tasks.findManyByIds(taskIds)
    if (tasks.length !== taskIds.length) {
      throw new NotFoundError('Task not found')
    }
    for (const task of tasks) {
      if (task.boardUserId !== userId || task.columnId !== columnId) {
        throw new ForbiddenError('Access denied')
      }
    }
    await this.tasks.reorder(columnId, taskIds)
  }
}

export class ListTaskCommentsUseCase {
  private readonly tasks: ITaskRepository

  constructor(tasks: ITaskRepository) {
    this.tasks = tasks
  }

  async execute(userId: string, taskId: string): Promise<Comment[]> {
    const task = await this.tasks.findById(taskId)
    if (!task || task.boardUserId !== userId) {
      throw new NotFoundError('Task not found')
    }
    return this.tasks.listComments(taskId)
  }
}
