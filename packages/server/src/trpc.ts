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
import { PrismaReminderRepository } from './infrastructure/repositories/PrismaReminderRepository.js'
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
    reminders: new PrismaReminderRepository(prisma),
    labels: new PrismaLabelRepository(prisma),
    notes: new PrismaNoteRepository(prisma),
    folders: new PrismaFolderRepository(prisma),
    chat: new PrismaChatRepository(prisma),
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>

const t = initTRPC.context<Context>().create()

const domainErrorMiddleware = t.middleware(async ({ next, path }) => {
  try {
    return await next()
  } catch (e) {
    console.error('DEBUG caught in domainErrorMiddleware:', {
      path,
      ctorName: (e as any)?.constructor?.name,
      isUnauthorized: e instanceof UnauthorizedError,
      isTRPCError: e instanceof TRPCError,
      isError: e instanceof Error,
    })
    if (e instanceof NotFoundError)        throw new TRPCError({ code: 'NOT_FOUND', message: e.message, cause: e })
    if (e instanceof ConflictError)        throw new TRPCError({ code: 'CONFLICT', message: e.message, cause: e })
    if (e instanceof UnauthorizedError)    throw new TRPCError({ code: 'UNAUTHORIZED', message: e.message, cause: e })
    if (e instanceof ForbiddenError)       throw new TRPCError({ code: 'FORBIDDEN', message: e.message, cause: e })
    if (e instanceof BadRequestError)      throw new TRPCError({ code: 'BAD_REQUEST', message: e.message, cause: e })
    if (e instanceof TooManyRequestsError) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: e.message, cause: e })
    if (e instanceof TRPCError) throw e

    // Unexpected errors (DB connectivity, etc.) must never leak raw internals
    // (stack traces, connection strings, file paths) to the client — log the
    // real cause server-side and surface a generic, user-facing message.
    console.error(`[trpc] unhandled error in ${path}:`, e)
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Ha ocurrido un error inesperado. Intenta de nuevo más tarde.',
      cause: e,
    })
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

// Per-IP limiter for brute-forceable auth endpoints (login, register, forgotPassword).
// Throws through the same domain-error pipeline above so 429s are always a well-formed
// tRPC response the client can parse — unlike a raw Fastify-level hook, which returns a
// bare JSON body that breaks httpBatchLink's response parsing (surfaces as a generic
// "Unable to transform response from server" instead of the real rate-limit message).
const AUTH_RATE_LIMIT_MAX = 5
const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const authRateLimits = new Map<string, { count: number; resetAt: number }>()

const AUTH_RATE_LIMIT_PRUNE_INTERVAL_MS = 5 * 60 * 1000
const authRateLimitPruneTimer = setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of authRateLimits) {
    if (entry.resetAt < now) authRateLimits.delete(key)
  }
}, AUTH_RATE_LIMIT_PRUNE_INTERVAL_MS)
authRateLimitPruneTimer.unref()

export const authProcedure = baseProcedure.use(async ({ ctx, next }) => {
  const key = ctx.req.ip
  const now = Date.now()
  const entry = authRateLimits.get(key)

  if (!entry || entry.resetAt < now) {
    authRateLimits.set(key, { count: 1, resetAt: now + AUTH_RATE_LIMIT_WINDOW_MS })
  } else {
    entry.count++
    if (entry.count > AUTH_RATE_LIMIT_MAX) {
      throw new TooManyRequestsError('Demasiados intentos. Intenta de nuevo en unos minutos.')
    }
  }

  return next()
})
