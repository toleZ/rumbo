import { z } from 'zod'
import { router, protectedProcedure } from '../trpc.js'
import { createTaskSchema, updateTaskSchema, moveTaskSchema } from '@rumbo/shared'
import {
  ListAllTasksUseCase,
  ListBoardTasksUseCase,
  CreateTaskUseCase,
  UpdateTaskUseCase,
  DeleteTaskUseCase,
  MoveTaskUseCase,
  ReorderTasksUseCase,
  ListTaskCommentsUseCase,
  ListTaskRemindersUseCase,
} from '../application/use-cases/tasks/TaskUseCases.js'
import { GoogleCalendarService } from '../infrastructure/google/GoogleCalendarService.js'
import {
  GetValidGoogleTokenUseCase,
  PushTaskToGoogleCalendarUseCase,
  MaybeAutoSyncTaskUseCase,
} from '../application/use-cases/connections/GoogleCalendarUseCases.js'

// Stateless adapter, safe to share across requests (mirrors connections.ts's pattern).
const google = new GoogleCalendarService()

export const tasksRouter = router({
  listAll: protectedProcedure.query(async ({ ctx }) => {
    return new ListAllTasksUseCase(ctx.tasks).execute(ctx.userId)
  }),

  list: protectedProcedure
    .input(z.object({ boardId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return new ListBoardTasksUseCase(ctx.boards, ctx.tasks).execute(ctx.userId, input.boardId)
    }),

  create: protectedProcedure.input(createTaskSchema).mutation(async ({ ctx, input }) => {
    const task = await new CreateTaskUseCase(ctx.boards, ctx.tasks).execute(ctx.userId, input)
    const getToken = new GetValidGoogleTokenUseCase(ctx.connections, google)
    const push = new PushTaskToGoogleCalendarUseCase(getToken, google, ctx.tasks, ctx.auth)
    await new MaybeAutoSyncTaskUseCase(ctx.auth, push).execute(ctx.userId, task)
    // Re-fetch: a successful auto-sync above updates googleCalendarEventId/Url in the DB,
    // which the `task` object returned by CreateTaskUseCase wouldn't reflect otherwise.
    return (await ctx.tasks.findById(task.id)) ?? task
  }),

  update: protectedProcedure.input(updateTaskSchema).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input
    const task = await new UpdateTaskUseCase(ctx.tasks).execute(ctx.userId, id, data)
    const getToken = new GetValidGoogleTokenUseCase(ctx.connections, google)
    const push = new PushTaskToGoogleCalendarUseCase(getToken, google, ctx.tasks, ctx.auth)
    await new MaybeAutoSyncTaskUseCase(ctx.auth, push).execute(ctx.userId, task)
    // Re-fetch for the same reason as `create` above.
    return (await ctx.tasks.findById(task.id)) ?? task
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deleteRemoteEvent = async (userId: string, eventId: string, calendarId: string | null) => {
        const token = await new GetValidGoogleTokenUseCase(ctx.connections, google).execute(userId)
        await google.deleteEvent(token, calendarId, eventId)
      }
      await new DeleteTaskUseCase(ctx.tasks, deleteRemoteEvent).execute(ctx.userId, input.id)
      return { success: true }
    }),

  move: protectedProcedure.input(moveTaskSchema).mutation(async ({ ctx, input }) => {
    return new MoveTaskUseCase(ctx.tasks, ctx.columns).execute(ctx.userId, input.taskId, input.columnId, input.order)
  }),

  reorder: protectedProcedure
    .input(z.object({ columnId: z.string().uuid(), taskIds: z.array(z.string().uuid()) }))
    .mutation(async ({ ctx, input }) => {
      await new ReorderTasksUseCase(ctx.columns, ctx.tasks).execute(ctx.userId, input.columnId, input.taskIds)
      return { success: true }
    }),

  comments: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return new ListTaskCommentsUseCase(ctx.tasks).execute(ctx.userId, input.taskId)
    }),

  reminders: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return new ListTaskRemindersUseCase(ctx.tasks).execute(ctx.userId, input.taskId)
    }),
})
