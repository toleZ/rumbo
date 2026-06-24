import { z } from 'zod'
import { router, protectedProcedure } from '../trpc.js'
import { createNoteSchema, updateNoteSchema } from '@rumbo/shared'
import {
  ListNotesUseCase,
  GetNoteUseCase,
  CreateNoteUseCase,
  UpdateNoteUseCase,
  DeleteNoteUseCase,
} from '../application/use-cases/notes/NoteUseCases.js'

export const notesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return new ListNotesUseCase(ctx.notes).execute(ctx.userId)
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return new GetNoteUseCase(ctx.notes).execute(ctx.userId, input.id)
    }),

  create: protectedProcedure.input(createNoteSchema).mutation(async ({ ctx, input }) => {
    return new CreateNoteUseCase(ctx.notes).execute(ctx.userId, input)
  }),

  update: protectedProcedure.input(updateNoteSchema).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input
    return new UpdateNoteUseCase(ctx.notes).execute(ctx.userId, id, data)
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await new DeleteNoteUseCase(ctx.notes).execute(ctx.userId, input.id)
      return { success: true }
    }),
})
