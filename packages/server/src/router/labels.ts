import { z } from 'zod'
import { router, protectedProcedure } from '../trpc.js'
import { createLabelSchema, updateLabelSchema, listLabelsSchema } from '@rumbo/shared'
import {
  ListAllLabelsUseCase,
  ListLabelsUseCase,
  CreateLabelUseCase,
  UpdateLabelUseCase,
  DeleteLabelUseCase,
} from '../application/use-cases/labels/LabelUseCases.js'

export const labelsRouter = router({
  listAll: protectedProcedure.query(async ({ ctx }) => {
    return new ListAllLabelsUseCase(ctx.labels).execute(ctx.userId)
  }),

  list: protectedProcedure.input(listLabelsSchema).query(async ({ ctx, input }) => {
    return new ListLabelsUseCase(ctx.boards, ctx.labels).execute(ctx.userId, input.boardId)
  }),

  create: protectedProcedure.input(createLabelSchema).mutation(async ({ ctx, input }) => {
    return new CreateLabelUseCase(ctx.boards, ctx.labels).execute(ctx.userId, input.boardId, input.name, input.color)
  }),

  update: protectedProcedure.input(updateLabelSchema).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input
    return new UpdateLabelUseCase(ctx.labels).execute(ctx.userId, id, data)
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await new DeleteLabelUseCase(ctx.labels).execute(ctx.userId, input.id)
      return { success: true }
    }),
})
