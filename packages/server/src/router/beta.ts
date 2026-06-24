import { router, publicProcedure } from '../trpc.js'
import { escapeHtml } from '../email/utils.js'
import { sendEmail } from '../email/transport.js'
import { env } from '../env.js'
import { betaApplySchema, contactSchema } from '@rumbo/shared'
import { ApplyBetaUseCase } from '../application/use-cases/beta/BetaUseCases.js'

export const betaRouter = router({
  applyBeta: publicProcedure.input(betaApplySchema).mutation(async ({ input, ctx }) => {
    return new ApplyBetaUseCase(ctx.beta).execute(input.name, input.email, input.message)
  }),

  contact: publicProcedure.input(contactSchema).mutation(async ({ input }) => {
    const name = escapeHtml(input.name)
    const email = escapeHtml(input.email)
    const message = escapeHtml(input.message)
    if (env.ADMIN_EMAIL) {
      await sendEmail(
        env.ADMIN_EMAIL,
        `Contacto desde Rumbo: ${name}`,
        `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
          <h2 style="color:#1C1C1E;">Mensaje de contacto</h2>
          <p style="color:#636366;"><strong>Nombre:</strong> ${name}</p>
          <p style="color:#636366;"><strong>Email:</strong> ${email}</p>
          <p style="color:#636366;"><strong>Mensaje:</strong></p>
          <p style="color:#1C1C1E;background:#F2F2F7;padding:16px;border-radius:10px;">${message}</p>
        </div>`,
      )
    }
    return { message: 'Mensaje enviado. Te responderemos pronto.' }
  }),
})
