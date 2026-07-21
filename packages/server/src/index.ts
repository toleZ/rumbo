import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify'
import { appRouter } from './router/index.js'
import { createContext } from './trpc.js'
import { env } from './env.js'
import { verifyAccessToken, verifyRefreshToken } from './auth/jwt.js'
import { COOKIE_OPTS_BASE } from './auth/session.js'
import { prisma } from './infrastructure/prisma/client.js'
import { PrismaAuthRepository } from './infrastructure/repositories/PrismaAuthRepository.js'
import { PrismaChatRepository } from './infrastructure/repositories/PrismaChatRepository.js'
import { PrismaBoardRepository } from './infrastructure/repositories/PrismaBoardRepository.js'
import { PrismaColumnRepository } from './infrastructure/repositories/PrismaColumnRepository.js'
import { PrismaTaskRepository } from './infrastructure/repositories/PrismaTaskRepository.js'
import { PrismaSubtaskRepository } from './infrastructure/repositories/PrismaSubtaskRepository.js'
import { PrismaLabelRepository } from './infrastructure/repositories/PrismaLabelRepository.js'
import { PrismaCommentRepository } from './infrastructure/repositories/PrismaCommentRepository.js'
import { PrismaReminderRepository } from './infrastructure/repositories/PrismaReminderRepository.js'
import { PrismaConnectionRepository } from './infrastructure/repositories/PrismaConnectionRepository.js'
import { OpenRouterService } from './infrastructure/ai/OpenRouterService.js'
import { SpotifyService } from './infrastructure/spotify/SpotifyService.js'
import { generateState, generateCodeVerifier, codeChallengeFromVerifier } from './infrastructure/spotify/pkce.js'
import { encrypt, decrypt } from './infrastructure/crypto/tokenCipher.js'
import { AssistantChatUseCase } from './application/use-cases/ai/AssistantChatUseCase.js'
import { ConnectSpotifyUseCase } from './application/use-cases/connections/ConnectionUseCases.js'

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

  // Per-IP auth rate limiting (login/register/forgotPassword) lives in the tRPC layer
  // (see `authProcedure` in trpc.ts) so a 429 is always a well-formed tRPC response —
  // a raw Fastify-level 429 body breaks httpBatchLink's response parsing on the client.

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
      reminders: new PrismaReminderRepository(prisma),
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

  // --- Spotify connection (OAuth authorization-code + PKCE) ---
  // Raw routes, not tRPC: these are top-level browser redirects (the user's browser
  // navigates to Spotify and back), so they can't carry the tRPC client's
  // `Authorization: Bearer` header. Auth here comes from the httpOnly `refreshToken`
  // cookie instead, which IS sent on a normal navigation.
  const authRepo = new PrismaAuthRepository(prisma)
  const connectionRepo = new PrismaConnectionRepository(prisma)
  const spotifyService = new SpotifyService()

  // Short-lived, encrypted, httpOnly cookie carrying the CSRF `state` + PKCE
  // `code_verifier` + the authenticated `userId` across the redirect to Spotify and
  // back. Encrypted (not just signed) so it never leaks the verifier in the clear.
  const OAUTH_COOKIE = 'spotify_oauth'
  const OAUTH_COOKIE_TTL_MS = 10 * 60 * 1000

  fastify.get('/api/connections/spotify/authorize', async (req, reply) => {
    if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) {
      return reply.status(404).send({ message: 'Spotify connection is not configured' })
    }

    const refreshTokenValue = req.cookies?.refreshToken
    if (!refreshTokenValue) return reply.status(401).send({ message: 'Unauthorized' })

    let userId: string
    try {
      const payload = verifyRefreshToken(refreshTokenValue)
      // Also check the DB, not just the JWT signature — a password change or logout
      // revokes rows via deleteAllRefreshTokensForUser/deleteRefreshToken, and a
      // stale-but-still-valid-looking JWT must not authorize a new connection.
      const stored = await authRepo.findRefreshToken(refreshTokenValue)
      if (!stored || stored.expiresAt < new Date()) {
        return reply.status(401).send({ message: 'Unauthorized' })
      }
      userId = payload.userId
    } catch {
      return reply.status(401).send({ message: 'Unauthorized' })
    }

    const state = generateState()
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = codeChallengeFromVerifier(codeVerifier)

    const cookiePayload = JSON.stringify({
      state,
      codeVerifier,
      userId,
      exp: Date.now() + OAUTH_COOKIE_TTL_MS,
    })
    reply.setCookie(OAUTH_COOKIE, encrypt(cookiePayload), {
      ...COOKIE_OPTS_BASE,
      maxAge: OAUTH_COOKIE_TTL_MS / 1000,
    })

    reply.redirect(spotifyService.getAuthorizeUrl(state, codeChallenge))
  })

  fastify.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    '/api/connections/spotify/callback',
    async (req, reply) => {
      const oauthCookie = req.cookies?.[OAUTH_COOKIE]
      reply.clearCookie(OAUTH_COOKIE, COOKIE_OPTS_BASE)

      const fail = () => reply.redirect(`${env.CLIENT_URL}/app?connection=spotify&status=error`)
      if (!oauthCookie || req.query.error || !req.query.code || !req.query.state) return fail()

      let payload: { state: string; codeVerifier: string; userId: string; exp: number }
      try {
        payload = JSON.parse(decrypt(oauthCookie))
      } catch {
        return fail()
      }

      // exp check bounds replay of an intercepted cookie; state check is the CSRF defense.
      if (payload.exp < Date.now() || payload.state !== req.query.state) return fail()

      try {
        await new ConnectSpotifyUseCase(connectionRepo, spotifyService).execute(
          payload.userId,
          req.query.code,
          payload.codeVerifier,
        )
      } catch (err) {
        req.log.error(err)
        return fail()
      }

      reply.redirect(`${env.CLIENT_URL}/app?connection=spotify&status=connected`)
    },
  )

  await fastify.listen({ port: env.PORT, host: '0.0.0.0' })
  console.log(`Server running on http://localhost:${env.PORT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
