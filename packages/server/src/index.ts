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
import { OpenRouterService } from './infrastructure/ai/OpenRouterService.js'

async function main() {
  const fastify = Fastify({ logger: true })

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
  fastify.post<{ Body: { message: string } }>('/api/ai/stream', {
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

    const { message } = req.body
    if (!message?.trim()) return reply.status(400).send({ message: 'Message required' })

    const chatRepo = new PrismaChatRepository(prisma)
    const openRouter = new OpenRouterService()

    // Fetch user context from DB in parallel
    const today = new Date().toISOString().slice(0, 10)
    const [recentTasks, recentNotes, habits, history] = await Promise.all([
      prisma.task.findMany({
        where: { column: { board: { userId } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { title: true, column: { select: { title: true } } },
      }),
      prisma.note.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: { title: true },
      }),
      prisma.habit.findMany({
        where: { userId },
        select: { name: true, habitType: true },
      }),
      chatRepo.getHistory(userId, 10),
    ])

    const taskList = recentTasks.length
      ? recentTasks.map((t) => `- ${t.title} [${t.column.title}]`).join('\n')
      : 'No tasks yet.'

    const noteList = recentNotes.length
      ? recentNotes.map((n) => `- ${n.title || 'Untitled'}`).join('\n')
      : 'No notes yet.'

    const habitList = habits.length
      ? habits.map((h) => `- ${h.name} (${h.habitType})`).join('\n')
      : 'No habits yet.'

    const systemPrompt = `You are a friendly, concise assistant built into Rumbo, a personal productivity app. Today is ${today}.

Respond naturally to whatever the user says. For casual conversation, greetings, or general questions, just reply normally — do not mention the user's tasks, notes, or habits unless they ask about them.

Only reference the data below when the user explicitly asks about their tasks, notes, habits, or productivity. When you do reference it, be brief and use the exact names shown.

<user_data>
Tasks (most recent ${recentTasks.length}):
${taskList}

Notes (most recent ${recentNotes.length}):
${noteList}

Habits:
${habitList}
</user_data>`

    // Build message history for context
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message.trim() },
    ]

    // Save user message to DB
    await chatRepo.saveMessage(userId, 'user', message.trim())

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
      for await (const chunk of openRouter.streamChat(messages)) {
        fullResponse += chunk
        reply.raw.write(`data: ${JSON.stringify({ text: chunk })}\n\n`)
      }
      // Save complete assistant response
      await chatRepo.saveMessage(userId, 'assistant', fullResponse)
    } catch (err) {
      reply.raw.write(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`)
    }

    reply.raw.write('data: [DONE]\n\n')
    reply.raw.end()
  })

  await fastify.listen({ port: env.PORT, host: '0.0.0.0' })
  console.log(`Server running on http://localhost:${env.PORT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
