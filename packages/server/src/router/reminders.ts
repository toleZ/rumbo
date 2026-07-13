import { z } from 'zod'
import { router, protectedProcedure } from '../trpc.js'
import { createReminderSchema, updateReminderSchema } from '@rumbo/shared'
import {
  ListAllRemindersUseCase,
  CreateReminderUseCase,
  UpdateReminderUseCase,
  AcknowledgeReminderUseCase,
  DeleteReminderUseCase,
} from '../application/use-cases/reminders/ReminderUseCases.js'

export const remindersRouter = router({
  // All of the user's reminders across every board/task — polled client-side
  // to badge task cards and detect when a reminder's time has been reached.
  listAll: protectedProcedure.query(async ({ ctx }) => {
    return new ListAllRemindersUseCase(ctx.reminders).execute(ctx.userId)
  }),

  create: protectedProcedure.input(createReminderSchema).mutation(async ({ ctx, input }) => {
    return new CreateReminderUseCase(ctx.tasks, ctx.reminders).execute(ctx.userId, input.taskId, input.remindAt)
  }),

  update: protectedProcedure.input(updateReminderSchema).mutation(async ({ ctx, input }) => {
    const { id, remindAt } = input
    return new UpdateReminderUseCase(ctx.reminders).execute(ctx.userId, id, remindAt)
  }),

  // Marks a reminder as shown (sets notifiedAt) so the client-side poller
  // doesn't toast it again after it's been surfaced once.
  acknowledge: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return new AcknowledgeReminderUseCase(ctx.reminders).execute(ctx.userId, input.id)
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await new DeleteReminderUseCase(ctx.reminders).execute(ctx.userId, input.id)
      return { success: true }
    }),
})
