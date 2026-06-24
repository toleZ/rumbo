export function passwordResetTemplate(code: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
      <h2 style="color: #1f2937;">Restablecer contraseña</h2>
      <p style="color: #4b5563;">Tu código para restablecer la contraseña es:</p>
      <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1f2937;">${code}</span>
      </div>
      <p style="color: #6b7280; font-size: 14px;">Este código expira en 15 minutos.</p>
      <p style="color: #6b7280; font-size: 14px;">Si no solicitaste restablecer tu contraseña, ignora este mensaje.</p>
    </div>
  `
}
