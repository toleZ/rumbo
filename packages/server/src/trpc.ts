import { initTRPC, TRPCError } from '@trpc/server'
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify'
import { verifyAccessToken } from './auth/jwt.js'
import '@fastify/cookie'
import { prisma } from './infrastructure/prisma/client.js'
import { PrismaAuthRepository } from './infrastructure/repositories/PrismaAuthRepository.js'
import { PrismaBetaRepository } from './infrastructure/repositories/PrismaBetaRepository.js'
import { PrismaHabitRepository } from './infrastructure/repositories/PrismaHabitRepository.js'
import { PrismaBoardRepository } from './infrastructure/repositories/PrismaBoardRepository.js'
import { PrismaColumnRepository } from './infrastructure/repositories/PrismaColumnRepository.js'
import { PrismaTaskRepository } from './infrastructure/repositories/PrismaTaskRepository.js'
import { PrismaSubtaskRepository } from './infrastructure/repositories/PrismaSubtaskRepository.js'
import { PrismaCommentRepository } from './infrastructure/repositories/PrismaCommentRepository.js'
import { PrismaLabelRepository } from './infrastructure/repositories/PrismaLabelRepository.js'
import { PrismaNoteRepository } from './infrastructure/repositories/PrismaNoteRepository.js'
import { PrismaFolderRepository } from './infrastructure/repositories/PrismaFolderRepository.js'

export async function createContext({ req, res }: CreateFastifyContextOptions) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  let userId: string | null = null

  if (token) {
    try {
      const payload = verifyAccessToken(token)
      userId = payload.userId
    } catch {
      // Invalid token, user stays null
    }
  }

  return {
    userId,
    req,
    res,
    auth: new PrismaAuthRepository(prisma),
    beta: new PrismaBetaRepository(prisma),
    habits: new PrismaHabitRepository(prisma),
    boards: new PrismaBoardRepository(prisma),
    columns: new PrismaColumnRepository(prisma),
    tasks: new PrismaTaskRepository(prisma),
    subtasks: new PrismaSubtaskRepository(prisma),
    comments: new PrismaCommentRepository(prisma),
    labels: new PrismaLabelRepository(prisma),
    notes: new PrismaNoteRepository(prisma),
    folders: new PrismaFolderRepository(prisma),
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>

const t = initTRPC.context<Context>().create()

export const router = t.router
export const publicProcedure = t.procedure

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'No autenticado' })
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } })
})
