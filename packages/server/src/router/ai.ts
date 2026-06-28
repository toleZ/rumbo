import { router, protectedProcedure } from '../trpc.js'
import { GetChatHistoryUseCase, ClearChatHistoryUseCase } from '../application/use-cases/ai/ChatUseCases.js'

export const aiRouter = router({
  history: protectedProcedure.query(async ({ ctx }) => {
    return new GetChatHistoryUseCase(ctx.chat).execute(ctx.userId)
  }),

  clearHistory: protectedProcedure.mutation(async ({ ctx }) => {
    await new ClearChatHistoryUseCase(ctx.chat).execute(ctx.userId)
    return { success: true }
  }),
})
