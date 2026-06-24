import { z } from 'zod'
import { router, protectedProcedure } from '../trpc.js'
import { createColumnSchema, updateColumnSchema } from '@rumbo/shared'
import { ListAllColumnsUseCase, ListBoardColumnsUseCase } from '../application/use-cases/columns/ListColumnsUseCase.js'
import { CreateColumnUseCase } from '../application/use-cases/columns/CreateColumnUseCase.js'
import { UpdateColumnUseCase } from '../application/use-cases/columns/UpdateColumnUseCase.js'
import { DeleteColumnUseCase } from '../application/use-cases/columns/DeleteColumnUseCase.js'
import { ReorderColumnsUseCase } from '../application/use-cases/columns/ReorderColumnsUseCase.js'

export const columnsRouter = router({
  listAll: protectedProcedure.query(async ({ ctx }) => {
    return new ListAllColumnsUseCase(ctx.columns).execute(ctx.userId)
  }),

  list: protectedProcedure
    .input(z.object({ boardId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return new ListBoardColumnsUseCase(ctx.boards, ctx.columns).execute(ctx.userId, input.boardId)
    }),

  create: protectedProcedure.input(createColumnSchema).mutation(async ({ ctx, input }) => {
    return new CreateColumnUseCase(ctx.boards, ctx.columns).execute(ctx.userId, input.title, input.boardId)
  }),

  update: protectedProcedure.input(updateColumnSchema).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input
    return new UpdateColumnUseCase(ctx.columns).execute(ctx.userId, id, data)
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await new DeleteColumnUseCase(ctx.columns).execute(ctx.userId, input.id)
      return { success: true }
    }),

  reorder: protectedProcedure
    .input(z.object({ columnIds: z.array(z.string().uuid()) }))
    .mutation(async ({ ctx, input }) => {
      await new ReorderColumnsUseCase(ctx.columns).execute(ctx.userId, input.columnIds)
      return { success: true }
    }),
})
