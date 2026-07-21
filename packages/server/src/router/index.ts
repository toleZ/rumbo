import { router } from '../trpc.js'
import { authRouter } from './auth.js'
import { betaRouter } from './beta.js'
import { boardsRouter } from './boards.js'
import { columnsRouter } from './columns.js'
import { tasksRouter } from './tasks.js'
import { subtasksRouter } from './subtasks.js'
import { commentsRouter } from './comments.js'
import { remindersRouter } from './reminders.js'
import { labelsRouter } from './labels.js'
import { notesRouter } from './notes.js'
import { foldersRouter } from './folders.js'
import { habitsRouter } from './habits.js'
import { aiRouter } from './ai.js'
import { connectionsRouter } from './connections.js'

export const appRouter = router({
  auth: authRouter,
  beta: betaRouter,
  boards: boardsRouter,
  columns: columnsRouter,
  tasks: tasksRouter,
  subtasks: subtasksRouter,
  comments: commentsRouter,
  reminders: remindersRouter,
  labels: labelsRouter,
  notes: notesRouter,
  folders: foldersRouter,
  habits: habitsRouter,
  ai: aiRouter,
  connections: connectionsRouter,
})

export type AppRouter = typeof appRouter
