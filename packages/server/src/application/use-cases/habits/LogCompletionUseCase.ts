import { TRPCError } from '@trpc/server'
import type { IHabitRepository } from '../../../domain/repositories/IHabitRepository.js'
import type { HabitCompletion } from '@rumbo/shared'

export class LogCompletionUseCase {
  private readonly habits: IHabitRepository

  constructor(habits: IHabitRepository) {
    this.habits = habits
  }

  async execute(userId: string, habitId: string, date: string, value: number): Promise<HabitCompletion> {
    const habit = await this.habits.findById(habitId)
    if (!habit || habit.userId !== userId) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Habit not found' })
    }
    return this.habits.upsertCompletion(habitId, date, value)
  }
}
