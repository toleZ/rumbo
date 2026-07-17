import { z } from 'zod'

export * from './types/index'

// Auth schemas
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  rememberMe: z.boolean().optional().default(true),
})

export const verifyEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  newPassword: z.string().min(8),
})

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(80),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
})

export const deleteAccountSchema = z.object({
  password: z.string(),
})

// Board schemas
export const createBoardSchema = z.object({
  name: z.string().min(1),
  color: z.string().nullable().optional(),
  columnTitles: z.array(z.string()).optional(),
})

export const updateBoardSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  color: z.string().nullable().optional(),
  order: z.number().optional(),
})

// Column schemas
export const createColumnSchema = z.object({
  title: z.string().min(1),
  boardId: z.string().uuid(),
})

export const updateColumnSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).optional(),
  order: z.number().optional(),
  isDone: z.boolean().optional(),
})

// Task schemas
export const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(''),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  columnId: z.string().uuid(),
  boardId: z.string().uuid(),
  scheduledDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  labelIds: z.array(z.string()).optional(),
})

export const updateTaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  columnId: z.string().uuid().optional(),
  scheduledDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  order: z.number().optional(),
  labelIds: z.array(z.string()).optional(),
})

export const moveTaskSchema = z.object({
  taskId: z.string().uuid(),
  columnId: z.string().uuid(),
  order: z.number(),
})

// Subtask schemas
export const createSubtaskSchema = z.object({
  taskId: z.string().uuid(),
  text: z.string().min(1),
})

export const updateSubtaskSchema = z.object({
  id: z.string().uuid(),
  text: z.string().min(1).optional(),
  completed: z.boolean().optional(),
})

// Comment schemas
export const createCommentSchema = z.object({
  taskId: z.string().uuid(),
  text: z.string().min(1),
})

// Reminder schemas
export const createReminderSchema = z.object({
  taskId: z.string().uuid(),
  remindAt: z.string(),
})

export const updateReminderSchema = z.object({
  id: z.string().uuid(),
  remindAt: z.string(),
})

// Label schemas
export const createLabelSchema = z.object({
  name: z.string().min(1),
  color: z.string(),
  boardId: z.string().uuid(),
})

export const listLabelsSchema = z.object({
  boardId: z.string().uuid(),
})

export const updateLabelSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  color: z.string().optional(),
})

// Note schemas
export const createNoteSchema = z.object({
  title: z.string().optional().default('Untitled'),
  content: z.string().optional().default(''),
  folderId: z.string().uuid().nullable().optional(),
})

export const updateNoteSchema = z.object({
  id: z.string().uuid(),
  title: z.string().optional(),
  content: z.string().optional(),
  folderId: z.string().uuid().nullable().optional(),
})

// Folder schemas
export const createFolderSchema = z.object({
  name: z.string().min(1),
  parentId: z.string().uuid().nullable().optional(),
})

export const updateFolderSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  parentId: z.string().uuid().nullable().optional(),
})

// Habit schemas
export const habitScheduleSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('daily') }),
  z.object({ type: z.literal('specific_days'), days: z.array(z.number().min(0).max(6)) }),
  z.object({ type: z.literal('times_per_week'), times: z.number().min(1).max(7) }),
  z.object({ type: z.literal('every_x_days'), days: z.number().min(1) }),
  z.object({ type: z.literal('x_per_month'), times: z.number().min(1).max(31) }),
])

export const createHabitSchema = z.object({
  name: z.string().min(1),
  habitType: z.enum(['boolean', 'measurable']),
  schedule: habitScheduleSchema,
  target: z.number().min(1).default(1),
  unit: z.string().optional().default(''),
  color: z.string(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  step: z.number().positive().nullable().optional(),
})

export const updateHabitSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  habitType: z.enum(['boolean', 'measurable']).optional(),
  schedule: habitScheduleSchema.optional(),
  target: z.number().min(1).optional(),
  unit: z.string().optional(),
  color: z.string().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  step: z.number().positive().nullable().optional(),
})

export const logCompletionSchema = z.object({
  habitId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  value: z.number().min(0),
})

export const removeCompletionSchema = z.object({
  habitId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export const logHabitExceptionSchema = z.object({
  habitId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(['postponed', 'skipped']),
  note: z.string().optional(),
})

export const removeHabitExceptionSchema = z.object({
  habitId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

// Beta & contact schemas
export const betaApplySchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  email: z.string().email('Correo inválido'),
  message: z.string().max(500).optional(),
})

export const contactSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  email: z.string().email('Correo inválido'),
  message: z.string().min(10, 'El mensaje debe tener al menos 10 caracteres'),
})
