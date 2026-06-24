import type { IHabitRepository, CreateHabitInput, HabitWithActivity } from '../../../domain/repositories/IHabitRepository.js'

export class CreateHabitUseCase {
  private readonly habits: IHabitRepository

  constructor(habits: IHabitRepository) {
    this.habits = habits
  }

  execute(userId: string, input: CreateHabitInput): Promise<HabitWithActivity> {
    return this.habits.create(userId, input)
  }
}
