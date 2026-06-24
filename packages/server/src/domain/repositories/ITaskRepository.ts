import type { Task, Subtask, Comment, Priority } from '@rumbo/shared'

export type TaskRecord = Task & { boardUserId: string }

export interface CreateTaskInput {
  title: string
  description?: string
  priority?: Priority
  columnId: string
  boardId: string
  scheduledDate?: string | null
  dueDate?: string | null
  labelIds?: string[]
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  priority?: Priority
  columnId?: string
  scheduledDate?: string | null
  dueDate?: string | null
  order?: number
  labelIds?: string[]
}

export interface ITaskRepository {
  findAllByUser(userId: string): Promise<Task[]>
  findByBoard(boardId: string): Promise<Task[]>
  findById(id: string): Promise<TaskRecord | null>
  findManyByIds(ids: string[]): Promise<TaskRecord[]>
  create(data: CreateTaskInput): Promise<Task>
  update(id: string, data: UpdateTaskInput): Promise<Task>
  delete(id: string): Promise<void>
  move(id: string, columnId: string, order: number): Promise<Task>
  reorder(columnId: string, taskIds: string[]): Promise<void>
  listSubtasks(taskId: string): Promise<Subtask[]>
  listComments(taskId: string): Promise<Comment[]>
}
