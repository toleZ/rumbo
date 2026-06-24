import nodemailer from 'nodemailer'
import { env } from '../env.js'

export const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } } : {}),
})

export async function sendEmail(to: string, subject: string, html: string) {
  await transporter.sendMail({
    from: '"Rumbo" <noreply@rumbo.app>',
    to,
    subject,
    html,
  })
}
