import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify'
import { appRouter } from './router/index.js'
import { createContext } from './trpc.js'
import { env } from './env.js'
import { verifyAccessToken } from './auth/jwt.js'
import { prisma } from './infrastructure/prisma/client.js'
import { PrismaChatRepository } from './infrastructure/repositories/PrismaChatRepository.js'
import { PrismaBoardRepository } from './infrastructure/repositories/PrismaBoardRepository.js'
import { PrismaColumnRepository } from './infrastructure/repositories/PrismaColumnRepository.js'
import { PrismaTaskRepository } from './infrastructure/repositories/PrismaTaskRepository.js'
import { PrismaSubtaskRepository } from './infrastructure/repositories/PrismaSubtaskRepository.js'
import { PrismaLabelRepository } from './infrastructure/repositories/PrismaLabelRepository.js'
import { PrismaCommentRepository } from './infrastructure/repositories/PrismaCommentRepository.js'
import { OpenRouterService } from './infrastructure/ai/OpenRouterService.js'
import { AssistantChatUseCase } from './application/use-cases/ai/AssistantChatUseCase.js'

const isDev = process.env.NODE_ENV !== 'production'

async function main() {
  const fastify = Fastify({
    disableRequestLogging: isDev,
    logger: {
      level: 'info',
      transport: isDev
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss',
              ignore: 'pid,hostname,reqId',
              singleLine: true,
            },
          }
        : undefined,
    },
  })

  if (isDev) {
    fastify.addHook('onResponse', (req, reply, done) => {
      req.log.info(`${req.method} ${req.url} → ${reply.statusCode} (${Math.round(reply.elapsedTime)}ms)`)
      done()
    })
  }

  await fastify.register(cors, {
    origin: env.CLIENT_URL,
    credentials: true,
  })

  await fastify.register(rateLimit, {
    max: 60,
    timeWindow: '1 minute',
  })

  await fastify.register(cookie)

  const authRateLimits = new Map<string, { count: number; resetAt: number }>()
  const AUTH_PATHS = ['/trpc/auth.login', '/trpc/auth.forgotPassword', '/trpc/auth.register']
  const AUTH_MAX = 5
  const AUTH_WINDOW = 15 * 60 * 1000

  // Periodically prune expired entries so the map doesn't grow unboundedly
  // under sustained traffic from many distinct IPs (scanners, botnets, etc.).
  const AUTH_PRUNE_INTERVAL = 5 * 60 * 1000 // every 5 minutes
  const pruneTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of authRateLimits) {
      if (entry.resetAt < now) authRateLimits.delete(key)
    }
  }, AUTH_PRUNE_INTERVAL)
  pruneTimer.unref() // don't prevent process exit

  fastify.addHook('preHandler', async (request, reply) => {
    if (!AUTH_PATHS.some((p) => request.url.startsWith(p))) return
    const key = request.ip
    const now = Date.now()
    const entry = authRateLimits.get(key)
    if (!entry || entry.resetAt < now) {
      authRateLimits.set(key, { count: 1, resetAt: now + AUTH_WINDOW })
      return
    }
    entry.count++
    if (entry.count > AUTH_MAX) {
      return reply.status(429).send({ message: 'Too many requests, try again later' })
    }
  })

  await fastify.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: {
      router: appRouter,
      createContext,
    },
  })

  fastify.get('/health', async () => ({ status: 'ok' }))

  // SSE streaming endpoint for AI chat — outside tRPC to avoid subscription complexity
  fastify.post<{ Body: { message: string; tzOffset?: number; today?: string; isRetry?: boolean } }>('/api/ai/stream', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    // Authenticate
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return reply.status(401).send({ message: 'Unauthorized' })

    let userId: string
    try {
      userId = verifyAccessToken(token).userId
    } catch {
      return reply.status(401).send({ message: 'Unauthorized' })
    }

    const { message, tzOffset, today, isRetry } = req.body
    if (typeof message !== 'string' || !message.trim()) {
      return reply.status(400).send({ message: 'Message required' })
    }
    const userMessage = message.trim()
    // Bound the prompt size — caps token cost and blocks oversized-payload abuse.
    if (userMessage.length > 4000) {
      return reply.status(400).send({ message: 'Message too long' })
    }

    const chatRepo = new PrismaChatRepository(prisma)
    const assistant = new AssistantChatUseCase({
      boards: new PrismaBoardRepository(prisma),
      columns: new PrismaColumnRepository(prisma),
      tasks: new PrismaTaskRepository(prisma),
      subtasks: new PrismaSubtaskRepository(prisma),
      labels: new PrismaLabelRepository(prisma),
      comments: new PrismaCommentRepository(prisma),
      chat: chatRepo,
      model: new OpenRouterService(),
    })

    // Abort controller so we stop model inference + tool execution when the
    // client disconnects mid-stream (closes tab, navigates away, etc.).
    const abortController = new AbortController()
    req.raw.on('close', () => abortController.abort())

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': env.CLIENT_URL,
      'Access-Control-Allow-Credentials': 'true',
    })

    let fullResponse = ''
    try {
      // run() snapshots history before we persist this message, so the message
      // isn't double-counted in the model context.
      for await (const event of assistant.run(userId, userMessage, {
        tzOffsetMinutes: tzOffset,
        today,
        signal: abortController.signal,
      })) {
        if (event.type === 'text') {
          fullResponse += event.text
          reply.raw.write(`data: ${JSON.stringify({ type: 'text', text: event.text })}\n\n`)
        } else if (event.type === 'action') {
          reply.raw.write(
            `data: ${JSON.stringify({ type: 'action', verb: event.verb, title: event.title })}\n\n`,
          )
        }
      }
    } catch (err) {
      // Suppress abort errors — the client is already gone.
      if (!abortController.signal.aborted) {
        req.log.error(err)
        const reason = err instanceof Error && err.message.includes('429') ? 'rate_limit' : undefined
        reply.raw.write(`data: ${JSON.stringify({ type: 'error', ...(reason ? { reason } : {}) })}\n\n`)
      }
    }

    // Persist the exchange after streaming (user first for correct ordering).
    // We still persist even on abort so partial conversations are not lost.
    try {
      if (!isRetry) await chatRepo.saveMessage(userId, 'user', userMessage)
      if (fullResponse.trim()) await chatRepo.saveMessage(userId, 'assistant', fullResponse)
    } catch (err) {
      req.log.error(err)
    }

    if (!abortController.signal.aborted) {
      reply.raw.write('data: [DONE]\n\n')
    }
    reply.raw.end()
  })

  await fastify.listen({ port: env.PORT, host: '0.0.0.0' })
  console.log(`Server running on http://localhost:${env.PORT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
