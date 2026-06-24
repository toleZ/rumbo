import type { Comment } from '@rumbo/shared'

export type CommentRecord = Comment & { boardUserId: string }

export interface ICommentRepository {
  findById(id: string): Promise<CommentRecord | null>
  listByTask(taskId: string): Promise<Comment[]>
  create(taskId: string, text: string): Promise<Comment>
  delete(id: string): Promise<void>
}
