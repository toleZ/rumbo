import { z } from 'zod'
import { router, protectedProcedure } from '../trpc.js'
import {
  createHabitSchema,
  updateHabitSchema,
  logCompletionSchema,
  removeCompletionSchema,
  logHabitExceptionSchema,
  removeHabitExceptionSchema,
} from '@rumbo/shared'
import { ListHabitsUseCase } from '../application/use-cases/habits/ListHabitsUseCase.js'
import { CreateHabitUseCase } from '../application/use-cases/habits/CreateHabitUseCase.js'
import { UpdateHabitUseCase } from '../application/use-cases/habits/UpdateHabitUseCase.js'
import { DeleteHabitUseCase } from '../application/use-cases/habits/DeleteHabitUseCase.js'
import { LogCompletionUseCase } from '../application/use-cases/habits/LogCompletionUseCase.js'
import { RemoveCompletionUseCase } from '../application/use-cases/habits/RemoveCompletionUseCase.js'
import { LogExceptionUseCase } from '../application/use-cases/habits/LogExceptionUseCase.js'
import { RemoveExceptionUseCase } from '../application/use-cases/habits/RemoveExceptionUseCase.js'

export const habitsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return new ListHabitsUseCase(ctx.habits).execute(ctx.userId)
  }),

  create: protectedProcedure.input(createHabitSchema).mutation(async ({ ctx, input }) => {
    return new CreateHabitUseCase(ctx.habits).execute(ctx.userId, input)
  }),

  update: protectedProcedure.input(updateHabitSchema).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input
    return new UpdateHabitUseCase(ctx.habits).execute(ctx.userId, id, data)
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await new DeleteHabitUseCase(ctx.habits).execute(ctx.userId, input.id)
      return { success: true }
    }),

  logCompletion: protectedProcedure.input(logCompletionSchema).mutation(async ({ ctx, input }) => {
    return new LogCompletionUseCase(ctx.habits).execute(ctx.userId, input.habitId, input.date, input.value)
  }),

  removeCompletion: protectedProcedure.input(removeCompletionSchema).mutation(async ({ ctx, input }) => {
    await new RemoveCompletionUseCase(ctx.habits).execute(ctx.userId, input.habitId, input.date)
    return { success: true }
  }),

  logException: protectedProcedure.input(logHabitExceptionSchema).mutation(async ({ ctx, input }) => {
    return new LogExceptionUseCase(ctx.habits).execute(ctx.userId, input.habitId, input.date, input.type, input.note)
  }),

  removeException: protectedProcedure.input(removeHabitExceptionSchema).mutation(async ({ ctx, input }) => {
    await new RemoveExceptionUseCase(ctx.habits).execute(ctx.userId, input.habitId, input.date)
    return { success: true }
  }),
})
