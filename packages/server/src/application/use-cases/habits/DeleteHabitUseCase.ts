import { TRPCError } from '@trpc/server'
import type { IHabitRepository } from '../../../domain/repositories/IHabitRepository.js'

export class DeleteHabitUseCase {
  private readonly habits: IHabitRepository

  constructor(habits: IHabitRepository) {
    this.habits = habits
  }

  async execute(userId: string, id: string): Promise<void> {
    const habit = await this.habits.findById(id)
    if (!habit || habit.userId !== userId) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Habit not found' })
    }
    await this.habits.delete(id)
  }
}
