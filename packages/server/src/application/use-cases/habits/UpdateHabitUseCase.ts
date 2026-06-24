import { TRPCError } from '@trpc/server'
import type { IHabitRepository, UpdateHabitInput, HabitWithActivity } from '../../../domain/repositories/IHabitRepository.js'

export class UpdateHabitUseCase {
  private readonly habits: IHabitRepository

  constructor(habits: IHabitRepository) {
    this.habits = habits
  }

  async execute(userId: string, id: string, data: UpdateHabitInput): Promise<HabitWithActivity> {
    const habit = await this.habits.findById(id)
    if (!habit || habit.userId !== userId) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Habit not found' })
    }
    return this.habits.update(id, data)
  }
}
