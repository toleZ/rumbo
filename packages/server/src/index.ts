import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify'
import { appRouter } from './router/index.js'
import { createContext } from './trpc.js'
import { env } from './env.js'

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

  await fastify.listen({ port: env.PORT, host: '0.0.0.0' })
  console.log(`Server running on http://localhost:${env.PORT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
