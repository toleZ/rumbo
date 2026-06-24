import type { IHabitRepository, HabitWithActivity } from '../../../domain/repositories/IHabitRepository.js'

export class ListHabitsUseCase {
  private readonly habits: IHabitRepository

  constructor(habits: IHabitRepository) {
    this.habits = habits
  }

  execute(userId: string): Promise<HabitWithActivity[]> {
    return this.habits.findAllByUser(userId)
  }
}
