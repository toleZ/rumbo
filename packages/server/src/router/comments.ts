import { z } from 'zod'
import { router, protectedProcedure } from '../trpc.js'
import { createCommentSchema } from '@rumbo/shared'
import {
  ListCommentsUseCase,
  CreateCommentUseCase,
  DeleteCommentUseCase,
} from '../application/use-cases/comments/CommentUseCases.js'

export const commentsRouter = router({
  list: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return new ListCommentsUseCase(ctx.tasks, ctx.comments).execute(ctx.userId, input.taskId)
    }),

  create: protectedProcedure.input(createCommentSchema).mutation(async ({ ctx, input }) => {
    return new CreateCommentUseCase(ctx.tasks, ctx.comments).execute(ctx.userId, input.taskId, input.text)
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await new DeleteCommentUseCase(ctx.comments).execute(ctx.userId, input.id)
      return { success: true }
    }),
})
