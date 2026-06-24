import type { PrismaClient } from '@prisma/client'
import type { Habit, HabitCompletion, HabitException, HabitSchedule, HabitType } from '@rumbo/shared'
import type {
  IHabitRepository,
  HabitRecord,
  HabitWithActivity,
  CreateHabitInput,
  UpdateHabitInput,
} from '../../domain/repositories/IHabitRepository.js'

export class PrismaHabitRepository implements IHabitRepository {
  private readonly db: PrismaClient

  constructor(db: PrismaClient) {
    this.db = db
  }

  async findAllByUser(userId: string, since?: string): Promise<HabitWithActivity[]> {
    const cutoff = since ?? (() => {
      const d = new Date()
      d.setDate(d.getDate() - 365)
      return d.toISOString().slice(0, 10)
    })()

    const rows = await this.db.habit.findMany({
      where: { userId },
      include: {
        completions: { where: { date: { gte: cutoff } } },
        exceptions: { where: { date: { gte: cutoff } } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return rows.map((r) => ({
      ...this.toHabit(r),
      completions: r.completions.map(this.toCompletion),
      exceptions: r.exceptions.map(this.toException),
    }))
  }

  async findById(id: string): Promise<HabitRecord | null> {
    const row = await this.db.habit.findUnique({ where: { id } })
    if (!row) return null
    return { ...this.toHabit(row), userId: row.userId }
  }

  async create(userId: string, data: CreateHabitInput): Promise<HabitWithActivity> {
    const row = await this.db.habit.create({
      data: {
        name: data.name,
        habitType: data.habitType,
        schedule: data.schedule,
        target: data.target,
        unit: data.unit,
        color: data.color,
        startDate: data.startDate ?? null,
        endDate: data.endDate ?? null,
        step: data.step ?? null,
        userId,
      },
      include: { completions: true, exceptions: true },
    })

    return {
      ...this.toHabit(row),
      completions: row.completions.map(this.toCompletion),
      exceptions: row.exceptions.map(this.toException),
    }
  }

  async update(id: string, data: UpdateHabitInput): Promise<HabitWithActivity> {
    const row = await this.db.habit.update({
      where: { id },
      data,
      include: { completions: true, exceptions: true },
    })

    return {
      ...this.toHabit(row),
      completions: row.completions.map(this.toCompletion),
      exceptions: row.exceptions.map(this.toException),
    }
  }

  async delete(id: string): Promise<void> {
    await this.db.habit.delete({ where: { id } })
  }

  async upsertCompletion(habitId: string, date: string, value: number): Promise<HabitCompletion> {
    const row = await this.db.habitCompletion.upsert({
      where: { habitId_date: { habitId, date } },
      update: { value },
      create: { habitId, date, value },
    })
    return this.toCompletion(row)
  }

  async deleteCompletion(habitId: string, date: string): Promise<void> {
    await this.db.habitCompletion.deleteMany({ where: { habitId, date } })
  }

  async upsertException(
    habitId: string,
    date: string,
    type: 'postponed' | 'skipped',
    note?: string,
  ): Promise<HabitException> {
    const row = await this.db.habitException.upsert({
      where: { habitId_date: { habitId, date } },
      update: { type, note: note ?? null },
      create: { habitId, date, type, note: note ?? null },
    })
    return this.toException(row)
  }

  async deleteException(habitId: string, date: string): Promise<void> {
    await this.db.habitException.deleteMany({ where: { habitId, date } })
  }

  private toHabit(row: {
    id: string
    name: string
    habitType: string
    schedule: unknown
    target: number
    unit: string
    color: string
    startDate: string | null
    endDate: string | null
    step: number | null
    createdAt: Date
  }): Habit {
    return {
      id: row.id,
      name: row.name,
      habitType: row.habitType as HabitType,
      schedule: row.schedule as HabitSchedule,
      target: row.target,
      unit: row.unit,
      color: row.color,
      startDate: row.startDate ?? null,
      endDate: row.endDate ?? null,
      step: row.step ?? null,
      createdAt: row.createdAt.toISOString(),
    }
  }

  private toCompletion(row: { id: string; habitId: string; date: string; value: number }): HabitCompletion {
    return { id: row.id, habitId: row.habitId, date: row.date, value: row.value }
  }

  private toException(row: { id: string; habitId: string; date: string; type: string; note: string | null }): HabitException {
    return {
      id: row.id,
      habitId: row.habitId,
      date: row.date,
      type: row.type as 'postponed' | 'skipped',
      note: row.note ?? undefined,
    }
  }
}
