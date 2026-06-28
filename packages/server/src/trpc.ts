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
import { PrismaChatRepository } from './infrastructure/repositories/PrismaChatRepository.js'
import {
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  BadRequestError,
  TooManyRequestsError,
} from './domain/errors.js'

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
    chat: new PrismaChatRepository(prisma),
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>

const t = initTRPC.context<Context>().create()

const domainErrorMiddleware = t.middleware(async ({ next }) => {
  try {
    return await next()
  } catch (e) {
    if (e instanceof NotFoundError)        throw new TRPCError({ code: 'NOT_FOUND', message: e.message, cause: e })
    if (e instanceof ConflictError)        throw new TRPCError({ code: 'CONFLICT', message: e.message, cause: e })
    if (e instanceof UnauthorizedError)    throw new TRPCError({ code: 'UNAUTHORIZED', message: e.message, cause: e })
    if (e instanceof ForbiddenError)       throw new TRPCError({ code: 'FORBIDDEN', message: e.message, cause: e })
    if (e instanceof BadRequestError)      throw new TRPCError({ code: 'BAD_REQUEST', message: e.message, cause: e })
    if (e instanceof TooManyRequestsError) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: e.message, cause: e })
    throw e
  }
})

const baseProcedure = t.procedure.use(domainErrorMiddleware)

export const router = t.router
export const publicProcedure = baseProcedure

export const protectedProcedure = baseProcedure.use(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'No autenticado' })
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } })
})
