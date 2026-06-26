import { NotFoundError } from '../../../domain/errors.js'
import type { IHabitRepository } from '../../../domain/repositories/IHabitRepository.js'
import type { HabitException } from '@rumbo/shared'

export class LogExceptionUseCase {
  private readonly habits: IHabitRepository

  constructor(habits: IHabitRepository) {
    this.habits = habits
  }

  async execute(
    userId: string,
    habitId: string,
    date: string,
    type: 'postponed' | 'skipped',
    note?: string,
  ): Promise<HabitException> {
    const habit = await this.habits.findById(habitId)
    if (!habit || habit.userId !== userId) {
      throw new NotFoundError('Habit not found')
    }
    return this.habits.upsertException(habitId, date, type, note)
  }
}
