import { z } from 'zod'
import { router, protectedProcedure } from '../trpc.js'
import { createFolderSchema, updateFolderSchema } from '@rumbo/shared'
import {
  ListFoldersUseCase,
  CreateFolderUseCase,
  UpdateFolderUseCase,
  DeleteFolderUseCase,
  ReorderFoldersUseCase,
} from '../application/use-cases/folders/FolderUseCases.js'

export const foldersRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return new ListFoldersUseCase(ctx.folders).execute(ctx.userId)
  }),

  create: protectedProcedure.input(createFolderSchema).mutation(async ({ ctx, input }) => {
    return new CreateFolderUseCase(ctx.folders).execute(ctx.userId, input.name, input.parentId)
  }),

  update: protectedProcedure.input(updateFolderSchema).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input
    return new UpdateFolderUseCase(ctx.folders).execute(ctx.userId, id, data)
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await new DeleteFolderUseCase(ctx.folders).execute(ctx.userId, input.id)
      return { success: true }
    }),

  reorder: protectedProcedure
    .input(z.object({
      folderIds: z.array(z.string().uuid()),
      parentId: z.string().uuid().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      await new ReorderFoldersUseCase(ctx.folders).execute(ctx.userId, input.folderIds, input.parentId)
      return { success: true }
    }),
})
