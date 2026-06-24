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
} from '../application/use-cases/tasks/TaskUseCases.js'

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
    return new CreateTaskUseCase(ctx.boards, ctx.tasks).execute(ctx.userId, input)
  }),

  update: protectedProcedure.input(updateTaskSchema).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input
    return new UpdateTaskUseCase(ctx.tasks).execute(ctx.userId, id, data)
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await new DeleteTaskUseCase(ctx.tasks).execute(ctx.userId, input.id)
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
})
