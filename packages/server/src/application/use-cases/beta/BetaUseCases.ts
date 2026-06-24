import { TRPCError } from '@trpc/server'
import type { IBetaRepository } from '../../../domain/repositories/IBetaRepository.js'
import { sendEmail } from '../../../email/transport.js'
import { betaConfirmationTemplate, betaAdminNotificationTemplate } from '../../../email/templates/betaConfirmation.js'
import { env } from '../../../env.js'

export class ApplyBetaUseCase {
  private readonly beta: IBetaRepository

  constructor(beta: IBetaRepository) {
    this.beta = beta
  }

  async execute(name: string, email: string, message?: string | null): Promise<{ message: string }> {
    const existing = await this.beta.findByEmail(email)
    if (existing) {
      throw new TRPCError({ code: 'CONFLICT', message: 'Este correo ya está registrado en la lista de espera.' })
    }

    await this.beta.create({ name, email, message })

    await Promise.allSettled([
      sendEmail(email, '¡Solicitud de beta recibida! — Rumbo', betaConfirmationTemplate(name)),
      ...(env.ADMIN_EMAIL
        ? [sendEmail(env.ADMIN_EMAIL, `Nueva solicitud beta: ${name}`, betaAdminNotificationTemplate(name, email, message ?? undefined))]
        : []),
    ])

    return { message: 'Solicitud enviada con éxito.' }
  }
}
