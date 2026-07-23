import { z } from 'zod'
import { router, publicProcedure, authProcedure, protectedProcedure } from '../trpc.js'
import {
  registerSchema, loginSchema, verifyEmailSchema, forgotPasswordSchema, resetPasswordSchema,
  updateProfileSchema, changePasswordSchema, deleteAccountSchema,
} from '@rumbo/shared'
import {
  RegisterUseCase,
  VerifyEmailUseCase,
  LoginUseCase,
  ForgotPasswordUseCase,
  ResetPasswordUseCase,
  UpdateProfileUseCase,
  ChangePasswordUseCase,
  DeleteAccountUseCase,
  RefreshTokenUseCase,
  LogoutUseCase,
} from '../application/use-cases/auth/AuthUseCases.js'
import { FastifySessionAdapter } from '../infrastructure/adapters/FastifySessionAdapter.js'

export const authRouter = router({
  register: authProcedure.input(registerSchema).mutation(async ({ input, ctx }) => {
    return new RegisterUseCase(ctx.auth).execute(input.email, input.password, input.name)
  }),

  verifyEmail: publicProcedure
    .input(verifyEmailSchema.extend({ rememberMe: z.boolean().optional().default(true) }))
    .mutation(async ({ input, ctx }) => {
      const session = new FastifySessionAdapter(ctx.auth, ctx.res)
      return new VerifyEmailUseCase(ctx.auth, session).execute(input.email, input.code, input.rememberMe)
    }),

  login: authProcedure.input(loginSchema).mutation(async ({ input, ctx }) => {
    const session = new FastifySessionAdapter(ctx.auth, ctx.res)
    return new LoginUseCase(ctx.auth, session).execute(input.email, input.password, input.rememberMe ?? true)
  }),

  forgotPassword: authProcedure.input(forgotPasswordSchema).mutation(async ({ input, ctx }) => {
    return new ForgotPasswordUseCase(ctx.auth).execute(input.email)
  }),

  resetPassword: publicProcedure.input(resetPasswordSchema).mutation(async ({ input, ctx }) => {
    return new ResetPasswordUseCase(ctx.auth).execute(input.email, input.code, input.newPassword)
  }),

  updateProfile: protectedProcedure.input(updateProfileSchema).mutation(async ({ input, ctx }) => {
    return new UpdateProfileUseCase(ctx.auth).execute(ctx.userId, input.name, input.timezone)
  }),

  changePassword: protectedProcedure.input(changePasswordSchema).mutation(async ({ input, ctx }) => {
    return new ChangePasswordUseCase(ctx.auth).execute(ctx.userId, input.currentPassword, input.newPassword)
  }),

  deleteAccount: protectedProcedure.input(deleteAccountSchema).mutation(async ({ input, ctx }) => {
    return new DeleteAccountUseCase(ctx.auth).execute(ctx.userId, input.password)
  }),

  refresh: publicProcedure.input(z.void()).mutation(async ({ ctx }) => {
    const session = new FastifySessionAdapter(ctx.auth, ctx.res)
    return new RefreshTokenUseCase(ctx.auth, session).execute(ctx.req.cookies?.refreshToken)
  }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    const session = new FastifySessionAdapter(ctx.auth, ctx.res)
    return new LogoutUseCase(ctx.auth, session).execute(ctx.req.cookies?.refreshToken)
  }),
})
