import { randomInt } from 'node:crypto'
import type { IAuthRepository } from '../../../domain/repositories/IAuthRepository.js'
import type { ISessionPort } from '../../ports/ISessionPort.js'
import {
  DomainError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  BadRequestError,
  TooManyRequestsError,
} from '../../../domain/errors.js'
import { hashPassword, comparePassword } from '../../../auth/password.js'
import { signAccessToken, verifyRefreshToken } from '../../../auth/jwt.js'
import { sendEmail } from '../../../email/transport.js'
import { verificationTemplate } from '../../../email/templates/verification.js'
import { passwordResetTemplate } from '../../../email/templates/passwordReset.js'
import { welcomeTemplate } from '../../../email/templates/welcome.js'

const MAX_OTP_ATTEMPTS = 5

function generateCode(): string {
  // randomInt is cryptographically secure; range is [100000, 1000000) → always 6 digits
  return String(randomInt(100000, 1000000))
}

type AuthedUser = { id: string; email: string; name: string | null }

export class RegisterUseCase {
  private readonly auth: IAuthRepository

  constructor(auth: IAuthRepository) {
    this.auth = auth
  }

  async execute(email: string, password: string, name?: string | null): Promise<{ message: string }> {
    const existing = await this.auth.findUserByEmail(email)
    if (existing) {
      throw new ConflictError('El correo ya está registrado')
    }

    const hashedPassword = await hashPassword(password)
    const user = await this.auth.createUser({ email, password: hashedPassword, name })

    const code = generateCode()
    await this.auth.invalidateVerificationCodes(user.id, 'email_verification')
    await this.auth.createVerificationCode(user.id, 'email_verification', code, new Date(Date.now() + 15 * 60 * 1000))
    await sendEmail(user.email, 'Verifica tu correo - Rumbo', verificationTemplate(code))

    return { message: 'Usuario registrado. Revisa tu correo para verificar tu cuenta.' }
  }
}

export class VerifyEmailUseCase {
  private readonly auth: IAuthRepository
  private readonly session: ISessionPort

  constructor(auth: IAuthRepository, session: ISessionPort) {
    this.auth = auth
    this.session = session
  }

  async execute(
    email: string,
    code: string,
    rememberMe: boolean,
  ): Promise<{ accessToken: string; user: AuthedUser }> {
    const user = await this.auth.findUserByEmail(email)
    if (!user) {
      throw new NotFoundError('Usuario no encontrado')
    }

    const verification = await this.auth.findActiveVerificationCode(user.id, 'email_verification')
    if (!verification) {
      throw new BadRequestError('Código inválido o expirado')
    }

    if (verification.attempts >= MAX_OTP_ATTEMPTS) {
      throw new TooManyRequestsError('Demasiados intentos. Solicita un nuevo código.')
    }

    if (verification.code !== code) {
      const newAttempts = verification.attempts + 1
      await this.auth.incrementVerificationAttempts(verification.id, newAttempts >= MAX_OTP_ATTEMPTS)
      throw new BadRequestError('Código inválido o expirado')
    }

    await this.auth.markVerificationCodeUsed(verification.id)
    await this.auth.updateUserEmailVerified(user.id, true)
    await sendEmail(user.email, '¡Bienvenido a Rumbo!', welcomeTemplate(user.name || undefined))

    const accessToken = signAccessToken(user.id)
    await this.session.create(user.id, rememberMe)

    return { accessToken, user: { id: user.id, email: user.email, name: user.name } }
  }
}

export class LoginUseCase {
  private readonly auth: IAuthRepository
  private readonly session: ISessionPort

  constructor(auth: IAuthRepository, session: ISessionPort) {
    this.auth = auth
    this.session = session
  }

  async execute(
    email: string,
    password: string,
    rememberMe: boolean,
  ): Promise<{ accessToken: string; user: AuthedUser }> {
    const user = await this.auth.findUserByEmail(email)
    if (!user) {
      throw new UnauthorizedError('Credenciales inválidas')
    }

    if (!user.emailVerified) {
      throw new ForbiddenError('Debes verificar tu correo antes de iniciar sesión')
    }

    const valid = await comparePassword(password, user.password)
    if (!valid) {
      throw new UnauthorizedError('Credenciales inválidas')
    }

    const accessToken = signAccessToken(user.id)
    await this.session.create(user.id, rememberMe)

    return { accessToken, user: { id: user.id, email: user.email, name: user.name } }
  }
}

export class ForgotPasswordUseCase {
  private readonly auth: IAuthRepository

  constructor(auth: IAuthRepository) {
    this.auth = auth
  }

  async execute(email: string): Promise<{ message: string }> {
    const user = await this.auth.findUserByEmail(email)
    if (!user) {
      return { message: 'Si el correo existe, recibirás un código de recuperación.' }
    }

    const code = generateCode()
    await this.auth.invalidateVerificationCodes(user.id, 'password_reset')
    await this.auth.createVerificationCode(user.id, 'password_reset', code, new Date(Date.now() + 15 * 60 * 1000))
    await sendEmail(user.email, 'Restablecer contraseña - Rumbo', passwordResetTemplate(code))

    return { message: 'Si el correo existe, recibirás un código de recuperación.' }
  }
}

export class ResetPasswordUseCase {
  private readonly auth: IAuthRepository

  constructor(auth: IAuthRepository) {
    this.auth = auth
  }

  async execute(email: string, code: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.auth.findUserByEmail(email)
    if (!user) {
      throw new NotFoundError('Usuario no encontrado')
    }

    const verification = await this.auth.findActiveVerificationCode(user.id, 'password_reset')
    if (!verification) {
      throw new BadRequestError('Código inválido o expirado')
    }

    if (verification.attempts >= MAX_OTP_ATTEMPTS) {
      throw new TooManyRequestsError('Demasiados intentos. Solicita un nuevo código.')
    }

    if (verification.code !== code) {
      const newAttempts = verification.attempts + 1
      await this.auth.incrementVerificationAttempts(verification.id, newAttempts >= MAX_OTP_ATTEMPTS)
      throw new BadRequestError('Código inválido o expirado')
    }

    await this.auth.markVerificationCodeUsed(verification.id)
    const hashedPassword = await hashPassword(newPassword)
    await this.auth.updateUserPassword(user.id, hashedPassword)
    await this.auth.deleteAllRefreshTokensForUser(user.id)

    return { message: 'Contraseña actualizada exitosamente' }
  }
}

export class UpdateProfileUseCase {
  private readonly auth: IAuthRepository

  constructor(auth: IAuthRepository) {
    this.auth = auth
  }

  async execute(userId: string, name: string): Promise<AuthedUser> {
    const user = await this.auth.findUserById(userId)
    if (!user) {
      throw new NotFoundError('Usuario no encontrado')
    }

    await this.auth.updateUserName(userId, name)
    return { id: user.id, email: user.email, name }
  }
}

export class ChangePasswordUseCase {
  private readonly auth: IAuthRepository

  constructor(auth: IAuthRepository) {
    this.auth = auth
  }

  async execute(userId: string, currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.auth.findUserById(userId)
    if (!user) {
      throw new NotFoundError('Usuario no encontrado')
    }

    const valid = await comparePassword(currentPassword, user.password)
    if (!valid) {
      throw new UnauthorizedError('Contraseña actual incorrecta')
    }

    const hashedPassword = await hashPassword(newPassword)
    await this.auth.updateUserPassword(userId, hashedPassword)
    // Revoke every existing session so other logged-in devices need to re-authenticate
    // with the new password — mirrors ResetPasswordUseCase's behavior.
    await this.auth.deleteAllRefreshTokensForUser(userId)

    return { message: 'Contraseña actualizada exitosamente' }
  }
}

export class DeleteAccountUseCase {
  private readonly auth: IAuthRepository

  constructor(auth: IAuthRepository) {
    this.auth = auth
  }

  async execute(userId: string, password: string): Promise<{ message: string }> {
    const user = await this.auth.findUserById(userId)
    if (!user) {
      throw new NotFoundError('Usuario no encontrado')
    }

    const valid = await comparePassword(password, user.password)
    if (!valid) {
      throw new UnauthorizedError('Contraseña incorrecta')
    }

    await this.auth.deleteUser(userId)
    return { message: 'Cuenta eliminada' }
  }
}

export class RefreshTokenUseCase {
  private readonly auth: IAuthRepository
  private readonly session: ISessionPort

  constructor(auth: IAuthRepository, session: ISessionPort) {
    this.auth = auth
    this.session = session
  }

  async execute(refreshTokenValue: string | undefined): Promise<{ accessToken: string }> {
    if (!refreshTokenValue) {
      throw new UnauthorizedError('Token inválido')
    }

    try {
      const payload = verifyRefreshToken(refreshTokenValue)
      const stored = await this.auth.findRefreshToken(refreshTokenValue)

      if (!stored || stored.expiresAt < new Date()) {
        throw new UnauthorizedError('Token inválido')
      }

      const accessToken = signAccessToken(payload.userId)
      await this.session.clear(refreshTokenValue)
      await this.session.create(payload.userId, stored.rememberMe)

      return { accessToken }
    } catch (e) {
      if (e instanceof DomainError) throw e
      throw new UnauthorizedError('Token inválido')
    }
  }
}

export class LogoutUseCase {
  private readonly session: ISessionPort

  constructor(_auth: IAuthRepository, session: ISessionPort) {
    this.session = session
  }

  async execute(refreshTokenValue: string | undefined): Promise<{ message: string }> {
    await this.session.clear(refreshTokenValue)
    return { message: 'Sesión cerrada' }
  }
}
