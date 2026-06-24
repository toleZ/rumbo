import { z } from 'zod'
import { router, protectedProcedure } from '../trpc.js'
import { createSubtaskSchema, updateSubtaskSchema } from '@rumbo/shared'
import {
  CreateSubtaskUseCase,
  UpdateSubtaskUseCase,
  DeleteSubtaskUseCase,
} from '../application/use-cases/subtasks/SubtaskUseCases.js'

export const subtasksRouter = router({
  create: protectedProcedure.input(createSubtaskSchema).mutation(async ({ ctx, input }) => {
    return new CreateSubtaskUseCase(ctx.tasks, ctx.subtasks).execute(ctx.userId, input.taskId, input.text)
  }),

  update: protectedProcedure.input(updateSubtaskSchema).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input
    return new UpdateSubtaskUseCase(ctx.subtasks).execute(ctx.userId, id, data)
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await new DeleteSubtaskUseCase(ctx.subtasks).execute(ctx.userId, input.id)
      return { success: true }
    }),
})
