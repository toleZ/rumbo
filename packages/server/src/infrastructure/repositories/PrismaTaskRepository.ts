import type { PrismaClient } from '@prisma/client'
import type { Task, Subtask, Comment, Reminder, Priority } from '@rumbo/shared'
import type {
  ITaskRepository,
  TaskRecord,
  CreateTaskInput,
  UpdateTaskInput,
} from '../../domain/repositories/ITaskRepository.js'

const TASK_INCLUDE = {
  subtasks: true,
  labels: { include: { label: true } },
} as const

export class PrismaTaskRepository implements ITaskRepository {
  private readonly db: PrismaClient

  constructor(db: PrismaClient) {
    this.db = db
  }

  async findAllByUser(userId: string): Promise<Task[]> {
    const rows = await this.db.task.findMany({
      where: { board: { userId } },
      include: TASK_INCLUDE,
      orderBy: { order: 'asc' },
    })
    return rows.map(this.toTask)
  }

  async findByBoard(boardId: string): Promise<Task[]> {
    const rows = await this.db.task.findMany({
      where: { boardId },
      include: TASK_INCLUDE,
      orderBy: { order: 'asc' },
    })
    return rows.map(this.toTask)
  }

  async findById(id: string): Promise<TaskRecord | null> {
    const row = await this.db.task.findUnique({
      where: { id },
      include: { ...TASK_INCLUDE, board: { select: { userId: true } } },
    })
    if (!row) return null
    return { ...this.toTask(row), boardUserId: row.board.userId }
  }

  async findManyByIds(ids: string[]): Promise<TaskRecord[]> {
    const rows = await this.db.task.findMany({
      where: { id: { in: ids } },
      include: { ...TASK_INCLUDE, board: { select: { userId: true } } },
    })
    return rows.map((row) => ({ ...this.toTask(row), boardUserId: row.board.userId }))
  }

  async create(data: CreateTaskInput): Promise<Task> {
    const count = await this.db.task.count({ where: { columnId: data.columnId } })
    const { labelIds, dueDate, scheduledDate, ...taskData } = data

    const task = await this.db.task.create({
      data: {
        ...taskData,
        description: taskData.description ?? '',
        priority: taskData.priority ?? 'medium',
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        order: count,
      },
    })

    if (labelIds && labelIds.length > 0) {
      await this.db.taskLabel.createMany({
        data: labelIds.map((labelId) => ({ taskId: task.id, labelId })),
      })
    }

    const result = await this.db.task.findUniqueOrThrow({
      where: { id: task.id },
      include: TASK_INCLUDE,
    })
    return this.toTask(result)
  }

  async update(id: string, data: UpdateTaskInput): Promise<Task> {
    const { labelIds, dueDate, scheduledDate, ...rest } = data

    await this.db.task.update({
      where: { id },
      data: {
        ...rest,
        ...(scheduledDate !== undefined && { scheduledDate: scheduledDate ? new Date(scheduledDate) : null }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      },
    })

    if (labelIds !== undefined) {
      await this.db.taskLabel.deleteMany({ where: { taskId: id } })
      if (labelIds.length > 0) {
        await this.db.taskLabel.createMany({
          data: labelIds.map((labelId) => ({ taskId: id, labelId })),
        })
      }
    }

    const result = await this.db.task.findUniqueOrThrow({
      where: { id },
      include: TASK_INCLUDE,
    })
    return this.toTask(result)
  }

  async delete(id: string): Promise<void> {
    await this.db.task.delete({ where: { id } })
  }

  async move(id: string, columnId: string, order: number): Promise<Task> {
    const row = await this.db.task.update({
      where: { id },
      data: { columnId, order },
      include: TASK_INCLUDE,
    })
    return this.toTask(row)
  }

  async reorder(_columnId: string, taskIds: string[]): Promise<void> {
    await this.db.$transaction(
      taskIds.map((taskId, index) =>
        this.db.task.update({ where: { id: taskId }, data: { order: index } })
      )
    )
  }

  async listSubtasks(taskId: string): Promise<Subtask[]> {
    const rows = await this.db.subtask.findMany({ where: { taskId } })
    return rows.map((r) => ({ id: r.id, text: r.text, completed: r.completed }))
  }

  async listComments(taskId: string): Promise<Comment[]> {
    const rows = await this.db.comment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
    })
    return rows.map((r) => ({ id: r.id, taskId: r.taskId, text: r.text, createdAt: r.createdAt.toISOString() }))
  }

  async listReminders(taskId: string): Promise<Reminder[]> {
    const rows = await this.db.reminder.findMany({
      where: { taskId },
      orderBy: { remindAt: 'asc' },
    })
    return rows.map((r) => ({
      id: r.id,
      taskId: r.taskId,
      remindAt: r.remindAt.toISOString(),
      notifiedAt: r.notifiedAt ? r.notifiedAt.toISOString() : null,
    }))
  }

  private toTask(row: {
    id: string
    title: string
    description: string
    columnId: string
    boardId: string
    priority: string
    scheduledDate: Date | null
    dueDate: Date | null
    createdAt: Date
    order: number
    subtasks: Array<{ id: string; text: string; completed: boolean }>
    labels: Array<{ label: { id: string } }>
  }): Task {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      columnId: row.columnId,
      boardId: row.boardId,
      priority: row.priority as Priority,
      scheduledDate: row.scheduledDate ? row.scheduledDate.toISOString() : null,
      dueDate: row.dueDate ? row.dueDate.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      order: row.order,
      subtasks: row.subtasks.map((s) => ({ id: s.id, text: s.text, completed: s.completed })),
      labels: row.labels.map((tl) => tl.label.id),
    }
  }
}
