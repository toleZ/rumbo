import type { Subtask } from '@rumbo/shared'

export type SubtaskRecord = Subtask & { boardUserId: string }

export interface ISubtaskRepository {
  findById(id: string): Promise<SubtaskRecord | null>
  create(taskId: string, text: string): Promise<Subtask>
  update(id: string, data: { text?: string; completed?: boolean }): Promise<Subtask>
  delete(id: string): Promise<void>
}
