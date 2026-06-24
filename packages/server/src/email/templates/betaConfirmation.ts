import { escapeHtml } from '../utils.js'

export function betaConfirmationTemplate(name: string): string {
  const n = escapeHtml(name)
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
      <h2 style="color: #1C1C1E; font-size: 22px; margin-bottom: 8px;">¡Solicitud recibida, ${n}!</h2>
      <p style="color: #636366; line-height: 1.6;">Gracias por tu interés en Rumbo. Hemos recibido tu solicitud para unirte a la beta.</p>
      <p style="color: #636366; line-height: 1.6;">Revisaremos tu solicitud y te contactaremos pronto con los próximos pasos.</p>
      <div style="margin: 28px 0; padding: 20px; background: #F2F2F7; border-radius: 12px;">
        <p style="color: #1C1C1E; font-size: 14px; margin: 0;">Mientras tanto, puedes seguirnos para actualizaciones sobre el lanzamiento.</p>
      </div>
      <p style="color: #8E8E93; font-size: 13px; margin-top: 24px;">— El equipo de Rumbo</p>
    </div>
  `
}

export function betaAdminNotificationTemplate(name: string, email: string, message?: string): string {
  const n = escapeHtml(name)
  const e = escapeHtml(email)
  const m = message ? escapeHtml(message) : undefined
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
      <h2 style="color: #1C1C1E;">Nueva solicitud de beta</h2>
      <p style="color: #636366;"><strong>Nombre:</strong> ${n}</p>
      <p style="color: #636366;"><strong>Email:</strong> ${e}</p>
      ${m ? `<p style="color: #636366;"><strong>Mensaje:</strong> ${m}</p>` : ''}
      <p style="color: #8E8E93; font-size: 13px; margin-top: 24px;">Rumbo Beta Program</p>
    </div>
  `
}
