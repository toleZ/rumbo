import { NotFoundError } from '../../../domain/errors.js'
import type { IHabitRepository } from '../../../domain/repositories/IHabitRepository.js'

export class RemoveExceptionUseCase {
  private readonly habits: IHabitRepository

  constructor(habits: IHabitRepository) {
    this.habits = habits
  }

  async execute(userId: string, habitId: string, date: string): Promise<void> {
    const habit = await this.habits.findById(habitId)
    if (!habit || habit.userId !== userId) {
      throw new NotFoundError('Habit not found')
    }
    await this.habits.deleteException(habitId, date)
  }
}
