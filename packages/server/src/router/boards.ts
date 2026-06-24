import { z } from 'zod'
import { router, protectedProcedure } from '../trpc.js'
import { createBoardSchema, updateBoardSchema } from '@rumbo/shared'
import { ListBoardsUseCase } from '../application/use-cases/boards/ListBoardsUseCase.js'
import { CreateBoardUseCase } from '../application/use-cases/boards/CreateBoardUseCase.js'
import { UpdateBoardUseCase } from '../application/use-cases/boards/UpdateBoardUseCase.js'
import { DeleteBoardUseCase } from '../application/use-cases/boards/DeleteBoardUseCase.js'

export const boardsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return new ListBoardsUseCase(ctx.boards).execute(ctx.userId)
  }),

  create: protectedProcedure.input(createBoardSchema).mutation(async ({ ctx, input }) => {
    return new CreateBoardUseCase(ctx.boards).execute(ctx.userId, input)
  }),

  update: protectedProcedure.input(updateBoardSchema).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input
    return new UpdateBoardUseCase(ctx.boards).execute(ctx.userId, id, data)
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await new DeleteBoardUseCase(ctx.boards).execute(ctx.userId, input.id)
      return { success: true }
    }),
})
