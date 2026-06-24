import { z } from 'zod'
import { router, publicProcedure } from '../trpc.js'
import { registerSchema, loginSchema, verifyEmailSchema, forgotPasswordSchema, resetPasswordSchema } from '@rumbo/shared'
import {
  RegisterUseCase,
  VerifyEmailUseCase,
  LoginUseCase,
  ForgotPasswordUseCase,
  ResetPasswordUseCase,
  RefreshTokenUseCase,
  LogoutUseCase,
} from '../application/use-cases/auth/AuthUseCases.js'

export const authRouter = router({
  register: publicProcedure.input(registerSchema).mutation(async ({ input, ctx }) => {
    return new RegisterUseCase(ctx.auth).execute(input.email, input.password, input.name)
  }),

  verifyEmail: publicProcedure
    .input(verifyEmailSchema.extend({ rememberMe: z.boolean().optional().default(true) }))
    .mutation(async ({ input, ctx }) => {
      return new VerifyEmailUseCase(ctx.auth).execute(input.email, input.code, input.rememberMe, ctx.res)
    }),

  login: publicProcedure.input(loginSchema).mutation(async ({ input, ctx }) => {
    return new LoginUseCase(ctx.auth).execute(input.email, input.password, input.rememberMe ?? true, ctx.res)
  }),

  forgotPassword: publicProcedure.input(forgotPasswordSchema).mutation(async ({ input, ctx }) => {
    return new ForgotPasswordUseCase(ctx.auth).execute(input.email)
  }),

  resetPassword: publicProcedure.input(resetPasswordSchema).mutation(async ({ input, ctx }) => {
    return new ResetPasswordUseCase(ctx.auth).execute(input.email, input.code, input.newPassword)
  }),

  refresh: publicProcedure.input(z.void()).mutation(async ({ ctx }) => {
    return new RefreshTokenUseCase(ctx.auth).execute(ctx.req.cookies?.refreshToken, ctx.res)
  }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    return new LogoutUseCase(ctx.auth).execute(ctx.req.cookies?.refreshToken, ctx.res)
  }),
})
