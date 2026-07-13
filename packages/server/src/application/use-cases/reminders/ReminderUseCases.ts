import { NotFoundError, BadRequestError } from '../../../domain/errors.js'
import type { IReminderRepository, ReminderWithTaskTitle } from '../../../domain/repositories/IReminderRepository.js'
import type { ITaskRepository } from '../../../domain/repositories/ITaskRepository.js'
import type { Reminder } from '@rumbo/shared'

// Enforced here (not just client-side) so every caller — the web UI, and the
// AI assistant's manage_reminder tool, which calls straight into these use
// cases — gets the same guard against malformed or already-past reminders.
function assertValidFutureRemindAt(remindAt: string): void {
  const time = new Date(remindAt).getTime()
  if (Number.isNaN(time)) {
    throw new BadRequestError('remindAt must be a valid date')
  }
  if (time <= Date.now()) {
    throw new BadRequestError('remindAt must be in the future')
  }
}

export class ListAllRemindersUseCase {
  private readonly reminders: IReminderRepository

  constructor(reminders: IReminderRepository) {
    this.reminders = reminders
  }

  execute(userId: string): Promise<ReminderWithTaskTitle[]> {
    return this.reminders.listAllByUser(userId)
  }
}

export class CreateReminderUseCase {
  private readonly tasks: ITaskRepository
  private readonly reminders: IReminderRepository

  constructor(tasks: ITaskRepository, reminders: IReminderRepository) {
    this.tasks = tasks
    this.reminders = reminders
  }

  async execute(userId: string, taskId: string, remindAt: string): Promise<Reminder> {
    const task = await this.tasks.findById(taskId)
    if (!task || task.boardUserId !== userId) {
      throw new NotFoundError('Task not found')
    }
    assertValidFutureRemindAt(remindAt)
    return this.reminders.create(taskId, remindAt)
  }
}

export class UpdateReminderUseCase {
  private readonly reminders: IReminderRepository

  constructor(reminders: IReminderRepository) {
    this.reminders = reminders
  }

  async execute(userId: string, id: string, remindAt: string): Promise<Reminder> {
    const reminder = await this.reminders.findById(id)
    if (!reminder || reminder.boardUserId !== userId) {
      throw new NotFoundError('Reminder not found')
    }
    assertValidFutureRemindAt(remindAt)
    return this.reminders.update(id, remindAt)
  }
}

export class AcknowledgeReminderUseCase {
  private readonly reminders: IReminderRepository

  constructor(reminders: IReminderRepository) {
    this.reminders = reminders
  }

  async execute(userId: string, id: string): Promise<Reminder> {
    const reminder = await this.reminders.findById(id)
    if (!reminder || reminder.boardUserId !== userId) {
      throw new NotFoundError('Reminder not found')
    }
    return this.reminders.markNotified(id)
  }
}

export class DeleteReminderUseCase {
  private readonly reminders: IReminderRepository

  constructor(reminders: IReminderRepository) {
    this.reminders = reminders
  }

  async execute(userId: string, id: string): Promise<void> {
    const reminder = await this.reminders.findById(id)
    if (!reminder || reminder.boardUserId !== userId) {
      throw new NotFoundError('Reminder not found')
    }
    await this.reminders.delete(id)
  }
}
