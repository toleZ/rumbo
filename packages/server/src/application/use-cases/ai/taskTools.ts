import { z } from 'zod'
import type { Task, Board, Column, Subtask, Reminder } from '@rumbo/shared'
import { NotFoundError, BadRequestError } from '../../../domain/errors.js'
import type { IBoardRepository } from '../../../domain/repositories/IBoardRepository.js'
import type { IColumnRepository } from '../../../domain/repositories/IColumnRepository.js'
import type { ITaskRepository } from '../../../domain/repositories/ITaskRepository.js'
import type { ISubtaskRepository } from '../../../domain/repositories/ISubtaskRepository.js'
import type { ILabelRepository } from '../../../domain/repositories/ILabelRepository.js'
import type { ICommentRepository } from '../../../domain/repositories/ICommentRepository.js'
import type { IReminderRepository } from '../../../domain/repositories/IReminderRepository.js'
import type { IConnectionRepository } from '../../../domain/repositories/IConnectionRepository.js'
import type { IAuthRepository } from '../../../domain/repositories/IAuthRepository.js'
import {
  CreateTaskUseCase,
  UpdateTaskUseCase,
  DeleteTaskUseCase,
  MoveTaskUseCase,
  ListAllTasksUseCase,
} from '../tasks/TaskUseCases.js'
import {
  CreateSubtaskUseCase,
  UpdateSubtaskUseCase,
  DeleteSubtaskUseCase,
} from '../subtasks/SubtaskUseCases.js'
import { CreateLabelUseCase } from '../labels/LabelUseCases.js'
import { CreateCommentUseCase } from '../comments/CommentUseCases.js'
import {
  CreateReminderUseCase,
  UpdateReminderUseCase,
  DeleteReminderUseCase,
} from '../reminders/ReminderUseCases.js'
import {
  GetValidGoogleTokenUseCase,
  PushTaskToGoogleCalendarUseCase,
  MaybeAutoSyncTaskUseCase,
} from '../connections/GoogleCalendarUseCases.js'
import { GoogleCalendarService } from '../../../infrastructure/google/GoogleCalendarService.js'
import type { ToolDefinition } from '../../ports/IAssistantModel.js'

// Stateless adapter, safe to share across requests (mirrors tasks.ts/connections.ts's
// module-level instantiation pattern).
const google = new GoogleCalendarService()

// The AI assistant's task mutations go through this same use-case chain as the tasks
// router, so a task created/edited/deleted via the assistant respects the user's Google
// Calendar auto-sync setting exactly like one created/edited/deleted from the UI —
// previously this file called CreateTaskUseCase/UpdateTaskUseCase/DeleteTaskUseCase
// directly with no Google wiring at all, so auto-sync silently never applied here.
async function autoSyncTask(deps: TaskToolDeps, userId: string, task: Task): Promise<void> {
  const getToken = new GetValidGoogleTokenUseCase(deps.connections, google)
  const push = new PushTaskToGoogleCalendarUseCase(getToken, google, deps.tasks, deps.auth)
  await new MaybeAutoSyncTaskUseCase(deps.auth, push).execute(userId, task)
}

const DEFAULT_LABEL_COLOR = '#6b7280'
// Cap how many tasks list_tasks returns so one call can't flood the context.
const TASK_LIST_LIMIT = 75

/**
 * Request-scoped cache for `findAllByUser` results. Boards and columns are
 * immutable during an AI request (the assistant cannot create/modify them), so
 * they're cached for the lifetime of the request. Tasks are cached too, but
 * the cache is invalidated whenever a mutation (create/update/move/delete)
 * occurs so subsequent tool calls see fresh data.
 *
 * This eliminates the repeated DB round-trips that happen when the model
 * invokes several tools in one turn (e.g. resolveTaskByTitle + list_tasks
 * + resolveOrClarify each calling findAllByUser independently).
 */
class RequestScopedCache {
  private boardsCache: Map<string, Promise<Board[]>> = new Map()
  private columnsCache: Map<string, Promise<Column[]>> = new Map()
  private tasksCache: Map<string, Promise<Task[]>> = new Map()

  constructor(
    private readonly boards: IBoardRepository,
    private readonly columns: IColumnRepository,
    private readonly tasks: ITaskRepository,
  ) {}

  getBoards(userId: string): Promise<Board[]> {
    let cached = this.boardsCache.get(userId)
    if (!cached) {
      cached = this.boards.findAllByUser(userId)
      this.boardsCache.set(userId, cached)
    }
    return cached
  }

  getColumns(userId: string): Promise<Column[]> {
    let cached = this.columnsCache.get(userId)
    if (!cached) {
      cached = this.columns.findAllByUser(userId)
      this.columnsCache.set(userId, cached)
    }
    return cached
  }

  getTasks(userId: string): Promise<Task[]> {
    let cached = this.tasksCache.get(userId)
    if (!cached) {
      cached = this.tasks.findAllByUser(userId)
      this.tasksCache.set(userId, cached)
    }
    return cached
  }

  /** Clears the task cache after a mutation so the next lookup hits the DB. */
  invalidateTasks(): void {
    this.tasksCache.clear()
  }
}

export interface TaskToolDeps {
  /** Always the authenticated user from the verified JWT — never from model args. */
  userId: string
  boards: IBoardRepository
  columns: IColumnRepository
  tasks: ITaskRepository
  subtasks: ISubtaskRepository
  labels: ILabelRepository
  comments: ICommentRepository
  reminders: IReminderRepository
  connections: IConnectionRepository
  auth: IAuthRepository
  /** Client's `Date.getTimezoneOffset()` (minutes), used to anchor bare dates to local midnight. */
  tzOffsetMinutes: number
  /** Client's local "today" as YYYY-MM-DD, used to compute each task's activeToday flag. */
  today: string
  /** Request-scoped cache for findAllByUser queries. */
  cache: RequestScopedCache
}

export interface TaskToolAction {
  verb: 'created' | 'updated' | 'moved' | 'deleted'
  title: string
}

export interface TaskToolOutcome {
  /** JSON-serialisable value handed back to the model as the tool result. */
  result: unknown
  /** Present only when a mutation actually happened (drives UI chips + cache refresh). */
  action?: TaskToolAction
}

/**
 * Creates a {@link TaskToolDeps} with a request-scoped cache attached. Call
 * this once per AI request so all tool calls within the same agentic loop
 * share cached `findAllByUser` results.
 */
export function createToolDeps(
  userId: string,
  repos: {
    boards: IBoardRepository
    columns: IColumnRepository
    tasks: ITaskRepository
    subtasks: ISubtaskRepository
    labels: ILabelRepository
    comments: ICommentRepository
    reminders: IReminderRepository
    connections: IConnectionRepository
    auth: IAuthRepository
  },
  tzOffsetMinutes: number,
  today: string,
): TaskToolDeps {
  return {
    userId,
    ...repos,
    tzOffsetMinutes,
    today,
    cache: new RequestScopedCache(repos.boards, repos.columns, repos.tasks),
  }
}

const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const

// OpenAI-style tool schemas advertised to the model.
export const TASK_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'list_tasks',
      description:
        "List the current user's tasks (title, board, status/column, priority, dates). scheduledDate is when the task starts and dueDate is when it's due; when a task has both, it spans that whole range inclusive (not just those two exact days). Each task includes activeToday: true if today falls anywhere within that range (or matches its only date) — use that flag, not raw date equality, to answer \"what's due/scheduled today\" questions. Use this tool to answer questions or to find the exact title of a task before updating/moving/deleting it.",
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_boards',
      description: "List the user's boards with their column (status) names and existing label names.",
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_task',
      description:
        'Create a new task. Provide boardName and columnName. If either is missing the tool returns a clarification request and does NOT create the task — ask the user which board and column to use, then call again.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'string', enum: [...PRIORITIES] },
          dueDate: { type: 'string', description: 'Due date as YYYY-MM-DD' },
          scheduledDate: { type: 'string', description: 'Scheduled date as YYYY-MM-DD' },
          boardName: { type: 'string' },
          columnName: { type: 'string' },
        },
        required: ['title'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_task',
      description:
        "Update an existing task, identified by its exact current title (taskTitle). Use `title` to rename it. To change a task's column/status, use move_task instead. If several tasks share the title you'll be asked to also pass boardName.",
      parameters: {
        type: 'object',
        properties: {
          taskTitle: { type: 'string', description: "The task's current exact title" },
          boardName: { type: 'string', description: 'Only needed to disambiguate if multiple tasks share the title' },
          title: { type: 'string', description: 'New title (use this to rename)' },
          description: { type: 'string' },
          priority: { type: 'string', enum: [...PRIORITIES] },
          dueDate: { type: ['string', 'null'], description: 'YYYY-MM-DD, or null to clear' },
          scheduledDate: { type: ['string', 'null'], description: 'YYYY-MM-DD, or null to clear' },
        },
        required: ['taskTitle'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'move_task',
      description:
        'Move a task (identified by its exact title) to a different column/status within its board. Get valid column names from list_boards.',
      parameters: {
        type: 'object',
        properties: {
          taskTitle: { type: 'string' },
          columnName: { type: 'string' },
          boardName: { type: 'string', description: 'Only needed to disambiguate if multiple tasks share the title' },
        },
        required: ['taskTitle', 'columnName'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_task',
      description:
        'Permanently delete a task (identified by its exact title). You MUST first ask the user to confirm; only call this with confirmed=true after they explicitly agree.',
      parameters: {
        type: 'object',
        properties: {
          taskTitle: { type: 'string' },
          confirmed: {
            type: 'boolean',
            description: 'Set true ONLY after the user explicitly confirmed the deletion.',
          },
          boardName: { type: 'string', description: 'Only needed to disambiguate if multiple tasks share the title' },
        },
        required: ['taskTitle', 'confirmed'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'manage_subtask',
      description:
        "Add, update, or delete a checklist subtask on a task. action='add' needs text; action='update' needs subtaskText plus completed and/or newText; action='delete' needs subtaskText.",
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['add', 'update', 'delete'] },
          taskTitle: { type: 'string' },
          text: { type: 'string', description: "For action='add': the new subtask text" },
          subtaskText: { type: 'string', description: "For update/delete: the subtask's current text" },
          completed: { type: 'boolean', description: "For action='update': mark done (true) or not (false)" },
          newText: { type: 'string', description: "For action='update': rename the subtask" },
          boardName: { type: 'string', description: 'Only to disambiguate if multiple tasks share the title' },
        },
        required: ['action', 'taskTitle'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_task_label',
      description:
        "Attach or remove a label on a task by name. action='add' attaches an existing label; if it doesn't exist on the task's board the tool reports that — ask the user before creating it with create_label. action='remove' detaches it.",
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['add', 'remove'] },
          taskTitle: { type: 'string' },
          labelName: { type: 'string' },
          boardName: { type: 'string' },
        },
        required: ['action', 'taskTitle', 'labelName'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_label',
      description:
        'Create a new label on a board. Only call this once the user has agreed to create the label.',
      parameters: {
        type: 'object',
        properties: {
          boardName: { type: 'string' },
          name: { type: 'string' },
          color: { type: 'string', description: 'Optional hex color, e.g. #ef4444' },
        },
        required: ['boardName', 'name'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_comment',
      description: 'Add a comment to a task (identified by its exact title).',
      parameters: {
        type: 'object',
        properties: {
          taskTitle: { type: 'string' },
          text: { type: 'string' },
          boardName: { type: 'string' },
        },
        required: ['taskTitle', 'text'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'manage_reminder',
      description:
        "Add, update, or delete a reminder on a task, identified by its exact title. A task can have several reminders — each is just a date+time (no note; the reminder will use the task's title). action='add' needs remindAt. action='update' needs newRemindAt (and, if the task has more than one reminder, remindAt to say which one — omit remindAt if the task has exactly one). action='delete' needs remindAt only if the task has more than one reminder, otherwise it can be omitted. remindAt/newRemindAt must include a time of day: use 'YYYY-MM-DD HH:mm' (24h, local time) or a full ISO 8601 datetime — unlike dueDate/scheduledDate, reminders are not date-only.",
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['add', 'update', 'delete'] },
          taskTitle: { type: 'string' },
          remindAt: { type: 'string', description: "'YYYY-MM-DD HH:mm' or ISO datetime. For add: the reminder time. For update/delete: identifies which reminder, only needed if the task has more than one." },
          newRemindAt: { type: 'string', description: "For action='update': the new date/time, 'YYYY-MM-DD HH:mm' or ISO datetime" },
          boardName: { type: 'string', description: 'Only to disambiguate if multiple tasks share the title' },
        },
        required: ['action', 'taskTitle'],
        additionalProperties: false,
      },
    },
  },
]

const createArgs = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(PRIORITIES).optional(),
  dueDate: z.string().optional(),
  scheduledDate: z.string().optional(),
  boardName: z.string().optional(),
  columnName: z.string().optional(),
})

const updateArgs = z.object({
  taskTitle: z.string().min(1),
  boardName: z.string().optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  priority: z.enum(PRIORITIES).optional(),
  dueDate: z.string().nullable().optional(),
  scheduledDate: z.string().nullable().optional(),
})

const moveArgs = z.object({
  taskTitle: z.string().min(1),
  columnName: z.string().min(1),
  boardName: z.string().optional(),
})

const deleteArgs = z.object({
  taskTitle: z.string().min(1),
  confirmed: z.boolean(),
  boardName: z.string().optional(),
})

const manageSubtaskArgs = z.object({
  action: z.enum(['add', 'update', 'delete']),
  taskTitle: z.string().min(1),
  text: z.string().min(1).optional(),
  subtaskText: z.string().min(1).optional(),
  completed: z.boolean().optional(),
  newText: z.string().min(1).optional(),
  boardName: z.string().optional(),
})

const setTaskLabelArgs = z.object({
  action: z.enum(['add', 'remove']),
  taskTitle: z.string().min(1),
  labelName: z.string().min(1),
  boardName: z.string().optional(),
})

const createLabelArgs = z.object({
  boardName: z.string().min(1),
  name: z.string().min(1),
  color: z.string().optional(),
})

const addCommentArgs = z.object({
  taskTitle: z.string().min(1),
  text: z.string().min(1),
  boardName: z.string().optional(),
})

const manageReminderArgs = z.object({
  action: z.enum(['add', 'update', 'delete']),
  taskTitle: z.string().min(1),
  remindAt: z.string().min(1).optional(),
  newRemindAt: z.string().min(1).optional(),
  boardName: z.string().optional(),
})

/**
 * Executes one tool call. Writes go through the existing task use cases, which
 * enforce per-user ownership. All inputs are Zod-validated; `userId` is taken
 * from {@link TaskToolDeps} (the JWT), never from the model-supplied arguments.
 */
export async function executeTaskTool(
  name: string,
  rawArgs: string,
  deps: TaskToolDeps,
): Promise<TaskToolOutcome> {
  const { userId, boards, columns, tasks, subtasks, labels, comments, reminders } = deps

  let args: unknown
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {}
  } catch {
    throw new BadRequestError('Invalid tool arguments (not valid JSON)')
  }

  switch (name) {
    case 'list_tasks': {
      const [all, cols, userBoards] = await Promise.all([
        deps.cache.getTasks(userId),
        deps.cache.getColumns(userId),
        deps.cache.getBoards(userId),
      ])
      const colTitle = new Map(cols.map((c) => [c.id, c.title]))
      // Map label id -> name across the user's boards so we can show label names.
      const labelName = new Map<string, string>()
      await Promise.all(
        userBoards.map(async (b) => {
          for (const l of await labels.listByBoard(b.id)) labelName.set(l.id, l.name)
        }),
      )
      // Cap the payload so a large board can't flood the model's context; keep
      // each task compact by omitting empty label/subtask arrays.
      const shown = all.slice(0, TASK_LIST_LIMIT)
      // Reminders aren't embedded on Task (unlike subtasks), so fetch them
      // per-task here — same technique as the labels lookup above.
      const remindersByTask = new Map<string, Reminder[]>()
      await Promise.all(
        shown.map(async (t) => {
          remindersByTask.set(t.id, await deps.tasks.listReminders(t.id))
        }),
      )
      return {
        result: {
          // No internal ids exposed — tasks are referenced by title.
          tasks: shown.map((t) => {
            const labelNames = t.labels.map((id) => labelName.get(id)).filter(Boolean)
            const subs = t.subtasks.map((s) => ({ text: s.text, done: s.completed }))
            const rems = (remindersByTask.get(t.id) ?? []).map((r) => ({ remindAt: r.remindAt }))
            return {
              title: t.title,
              status: colTitle.get(t.columnId) ?? 'Unknown',
              priority: t.priority,
              dueDate: t.dueDate,
              scheduledDate: t.scheduledDate,
              // Deterministic range-containment check (matches the app's Today/Calendar
              // views) so the model doesn't have to reason about date ranges itself.
              activeToday: isActiveOnDate(t, deps.today, deps.tzOffsetMinutes),
              ...(labelNames.length ? { labels: labelNames } : {}),
              ...(subs.length ? { subtasks: subs } : {}),
              ...(rems.length ? { reminders: rems } : {}),
            }
          }),
          ...(all.length > TASK_LIST_LIMIT
            ? { note: `Showing ${TASK_LIST_LIMIT} of ${all.length} tasks; ask the user to narrow down if needed.` }
            : {}),
        },
      }
    }

    case 'list_boards': {
      const userBoards = await deps.cache.getBoards(userId)
      const boardList = await Promise.all(
        userBoards.map(async (b) => {
          const [cols, boardLabels] = await Promise.all([
            columns.findByBoard(b.id),
            labels.listByBoard(b.id),
          ])
          return {
            board: b.name,
            columns: cols.map((c) => c.title),
            labels: boardLabels.map((l) => l.name),
          }
        }),
      )
      return { result: { boards: boardList } }
    }

    case 'create_task': {
      const a = createArgs.parse(args)
      const target = await resolveOrClarify(deps, a.boardName, a.columnName)
      if ('clarify' in target) {
        // Board/column not specified — surface options and let the model ask.
        return { result: target.clarify }
      }
      const task = await new CreateTaskUseCase(boards, tasks).execute(userId, {
        title: a.title,
        description: a.description,
        priority: a.priority,
        boardId: target.boardId,
        columnId: target.columnId,
        dueDate: toStoredDate(a.dueDate ?? null, deps.tzOffsetMinutes),
        scheduledDate: toStoredDate(a.scheduledDate ?? null, deps.tzOffsetMinutes),
      })
      await autoSyncTask(deps, userId, task)
      deps.cache.invalidateTasks()
      return {
        result: { ok: true, task: { title: task.title } },
        action: { verb: 'created', title: task.title },
      }
    }

    case 'update_task': {
      const a = updateArgs.parse(args)
      const { task: found, exact } = await resolveTaskByTitle(deps, a.taskTitle, a.boardName)
      const task = await new UpdateTaskUseCase(tasks).execute(userId, found.id, {
        title: a.title,
        description: a.description,
        priority: a.priority,
        dueDate: toStoredDate(a.dueDate, deps.tzOffsetMinutes),
        scheduledDate: toStoredDate(a.scheduledDate, deps.tzOffsetMinutes),
      })
      await autoSyncTask(deps, userId, task)
      deps.cache.invalidateTasks()
      return {
        result: { ok: true, task: { title: task.title }, ...(exact ? {} : { matchedTask: found.title }) },
        action: { verb: 'updated', title: task.title },
      }
    }

    case 'move_task': {
      const a = moveArgs.parse(args)
      const { task: found, exact } = await resolveTaskByTitle(deps, a.taskTitle, a.boardName)
      // Moving relocates a task; don't act on a loose title match without confirming.
      if (!exact) return partialMatchClarification(a.taskTitle, found.title)

      const boardCols = await columns.findByBoard(found.boardId)
      const dest = boardCols.find(
        (c) => c.title.toLowerCase() === a.columnName.trim().toLowerCase(),
      )
      if (!dest) throw new BadRequestError(`No column named "${a.columnName}" on this board`)

      const boardTasks = await tasks.findByBoard(found.boardId)
      const order = boardTasks.filter((t) => t.columnId === dest.id).length
      const moved = await new MoveTaskUseCase(tasks, columns).execute(userId, found.id, dest.id, order)
      deps.cache.invalidateTasks()
      return {
        result: { ok: true, task: { title: moved.title, status: dest.title } },
        action: { verb: 'moved', title: moved.title },
      }
    }

    case 'delete_task': {
      const a = deleteArgs.parse(args)
      const { task: found, exact } = await resolveTaskByTitle(deps, a.taskTitle, a.boardName)
      // Deleting is destructive; a loose title match must be confirmed against the
      // exact title before we honor confirmed=true (blocks "delete X, just do it").
      if (!exact) return partialMatchClarification(a.taskTitle, found.title)

      if (!a.confirmed) {
        return {
          result: {
            ok: false,
            needsConfirmation: true,
            message: `Ask the user to confirm deleting "${found.title}", then call delete_task again with confirmed=true.`,
          },
        }
      }

      const deleteRemoteEvent = async (uid: string, eventId: string, calendarId: string | null) => {
        const token = await new GetValidGoogleTokenUseCase(deps.connections, google).execute(uid)
        await google.deleteEvent(token, calendarId, eventId)
      }
      await new DeleteTaskUseCase(tasks, deleteRemoteEvent).execute(userId, found.id)
      deps.cache.invalidateTasks()
      return {
        result: { ok: true, deleted: found.title },
        action: { verb: 'deleted', title: found.title },
      }
    }

    case 'manage_subtask': {
      const a = manageSubtaskArgs.parse(args)
      const { task: found } = await resolveTaskByTitle(deps, a.taskTitle, a.boardName)

      if (a.action === 'add') {
        if (!a.text) throw new BadRequestError("action='add' requires text.")
        await new CreateSubtaskUseCase(tasks, subtasks).execute(userId, found.id, a.text)
        return {
          result: { ok: true, task: found.title, addedSubtask: a.text },
          action: { verb: 'updated', title: found.title },
        }
      }

      if (!a.subtaskText) throw new BadRequestError(`action='${a.action}' requires subtaskText.`)
      const sub = await resolveSubtaskByText(deps, found.id, a.subtaskText)

      if (a.action === 'delete') {
        await new DeleteSubtaskUseCase(subtasks).execute(userId, sub.id)
        return {
          result: { ok: true, task: found.title, removedSubtask: sub.text },
          action: { verb: 'updated', title: found.title },
        }
      }

      // action === 'update'
      if (a.completed === undefined && a.newText === undefined) {
        throw new BadRequestError("action='update' requires completed and/or newText.")
      }
      await new UpdateSubtaskUseCase(subtasks).execute(userId, sub.id, {
        completed: a.completed,
        text: a.newText,
      })
      return {
        result: {
          ok: true,
          task: found.title,
          subtask: a.newText ?? sub.text,
          done: a.completed ?? sub.completed,
        },
        action: { verb: 'updated', title: found.title },
      }
    }

    case 'set_task_label': {
      const a = setTaskLabelArgs.parse(args)
      const { task: found } = await resolveTaskByTitle(deps, a.taskTitle, a.boardName)
      const boardLabels = await labels.listByBoard(found.boardId)
      const label = boardLabels.find(
        (l) => l.name.toLowerCase() === a.labelName.trim().toLowerCase(),
      )

      if (a.action === 'remove') {
        if (!label || !found.labels.includes(label.id)) {
          return {
            result: { ok: false, message: `Task "${found.title}" has no label named "${a.labelName}".` },
          }
        }
        const updated = await new UpdateTaskUseCase(tasks).execute(userId, found.id, {
          labelIds: found.labels.filter((id) => id !== label.id),
        })
        await autoSyncTask(deps, userId, updated)
        deps.cache.invalidateTasks()
        return {
          result: { ok: true, task: found.title, removedLabel: label.name },
          action: { verb: 'updated', title: found.title },
        }
      }

      // action === 'add'
      if (!label) {
        return {
          result: {
            ok: false,
            needsConfirmation: true,
            message: `The label "${a.labelName}" does not exist on this board. Ask the user whether to create it; if they agree, call create_label and then set_task_label again.`,
            existingLabels: boardLabels.map((l) => l.name),
          },
        }
      }
      if (found.labels.includes(label.id)) {
        return { result: { ok: true, task: found.title, label: label.name, note: 'already assigned' } }
      }
      const updated = await new UpdateTaskUseCase(tasks).execute(userId, found.id, {
        labelIds: [...found.labels, label.id],
      })
      await autoSyncTask(deps, userId, updated)
      deps.cache.invalidateTasks()
      return {
        result: { ok: true, task: found.title, label: label.name },
        action: { verb: 'updated', title: found.title },
      }
    }

    case 'create_label': {
      const a = createLabelArgs.parse(args)
      const board = await resolveBoardByName(deps, a.boardName)
      const label = await new CreateLabelUseCase(boards, labels).execute(
        userId,
        board.id,
        a.name,
        a.color ?? DEFAULT_LABEL_COLOR,
      )
      return {
        result: { ok: true, label: label.name, board: board.name },
        action: { verb: 'created', title: label.name },
      }
    }

    case 'add_comment': {
      const a = addCommentArgs.parse(args)
      const { task: found } = await resolveTaskByTitle(deps, a.taskTitle, a.boardName)
      await new CreateCommentUseCase(tasks, comments).execute(userId, found.id, a.text)
      return {
        result: { ok: true, task: found.title },
        action: { verb: 'updated', title: found.title },
      }
    }

    case 'manage_reminder': {
      const a = manageReminderArgs.parse(args)
      const { task: found } = await resolveTaskByTitle(deps, a.taskTitle, a.boardName)

      if (a.action === 'add') {
        if (!a.remindAt) throw new BadRequestError("action='add' requires remindAt.")
        const remindAt = toStoredDateTime(a.remindAt, deps.tzOffsetMinutes)
        const created = await new CreateReminderUseCase(tasks, reminders).execute(userId, found.id, remindAt)
        return {
          result: { ok: true, task: found.title, remindAt: created.remindAt },
          action: { verb: 'updated', title: found.title },
        }
      }

      const target = await resolveReminder(deps, found.id, a.remindAt)

      if (a.action === 'delete') {
        await new DeleteReminderUseCase(reminders).execute(userId, target.id)
        return {
          result: { ok: true, task: found.title, removedReminder: target.remindAt },
          action: { verb: 'updated', title: found.title },
        }
      }

      // action === 'update'
      if (!a.newRemindAt) throw new BadRequestError("action='update' requires newRemindAt.")
      const newRemindAt = toStoredDateTime(a.newRemindAt, deps.tzOffsetMinutes)
      const updated = await new UpdateReminderUseCase(reminders).execute(userId, target.id, newRemindAt)
      return {
        result: { ok: true, task: found.title, remindAt: updated.remindAt },
        action: { verb: 'updated', title: found.title },
      }
    }

    default:
      throw new BadRequestError(`Unknown tool: ${name}`)
  }
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Converts a bare `YYYY-MM-DD` from the model into local-midnight-as-UTC for the
 * client's timezone — matching how the app's DatePicker stores dates — so the
 * task lands on the calendar day the user actually meant (no off-by-one). Values
 * that already carry a time component, or null/undefined, are passed through.
 */
function toStoredDate(value: string | null, tzOffsetMinutes: number): string | null
function toStoredDate(value: string | null | undefined, tzOffsetMinutes: number): string | null | undefined
function toStoredDate(value: string | null | undefined, tzOffsetMinutes: number): string | null | undefined {
  if (value == null || !DATE_ONLY.test(value)) return value
  const [y, m, d] = value.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + tzOffsetMinutes * 60_000).toISOString()
}

/** Inverse of {@link toStoredDate}: recovers the client-local YYYY-MM-DD from a stored timestamp. */
function toLocalDateOnly(stored: string, tzOffsetMinutes: number): string {
  return new Date(new Date(stored).getTime() - tzOffsetMinutes * 60_000).toISOString().slice(0, 10)
}

const DATE_TIME_LOCAL = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/

/**
 * Converts a model-supplied reminder time into a stored ISO datetime. Unlike
 * {@link toStoredDate} (date-only, kept separate on purpose so dueDate/
 * scheduledDate semantics never change), reminders need a time of day:
 * - bare `YYYY-MM-DD` is anchored to local midnight (same math as toStoredDate)
 * - `YYYY-MM-DD HH:mm[:ss]` (or with a `T` separator) is anchored to that local time
 * - anything else is assumed to already be a full ISO datetime and is trusted as-is
 */
function toStoredDateTime(value: string, tzOffsetMinutes: number): string {
  if (DATE_ONLY.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d) + tzOffsetMinutes * 60_000).toISOString()
  }
  const match = DATE_TIME_LOCAL.exec(value.trim())
  if (match) {
    const [, y, mo, d, h, mi, s] = match
    return new Date(
      Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? 0)) + tzOffsetMinutes * 60_000,
    ).toISOString()
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) throw new BadRequestError(`Invalid date/time: "${value}"`)
  return parsed.toISOString()
}

/**
 * A task is "active" on `today` (YYYY-MM-DD) if today falls anywhere within its
 * scheduledDate..dueDate range (inclusive), matching the same semantics the
 * Today/Calendar UI already uses (`TodayPage.tsx`'s `isActiveToday`). Falls back
 * to an exact-date match when only one of the two dates is set.
 */
function isActiveOnDate(task: Task, today: string, tzOffsetMinutes: number): boolean {
  const s = task.scheduledDate ? toLocalDateOnly(task.scheduledDate, tzOffsetMinutes) : null
  const d = task.dueDate ? toLocalDateOnly(task.dueDate, tzOffsetMinutes) : null
  if (s && d) return s <= today && today <= d
  if (s) return s === today
  if (d) return d === today
  return false
}

/**
 * Finds a task by its (case-insensitive) title within the user's own tasks.
 * `findAllByUser` is already user-scoped, so ownership is guaranteed. Prefers an
 * exact title match, falling back to a unique partial match. Throws a helpful
 * error when nothing matches or when the title is ambiguous (so the assistant
 * can ask the user to specify the board).
 */
async function resolveTaskByTitle(
  deps: TaskToolDeps,
  title: string,
  boardName?: string,
): Promise<{ task: Task; exact: boolean }> {
  const all = await deps.cache.getTasks(deps.userId)
  const needle = title.trim().toLowerCase()

  // `exact` records whether the title matched verbatim; a substring ("partial")
  // match is looser and could resolve to the wrong task, so callers can require
  // confirmation before acting on it.
  let exact = true
  let matches = all.filter((t) => t.title.toLowerCase() === needle)
  if (matches.length === 0) {
    exact = false
    matches = all.filter((t) => t.title.toLowerCase().includes(needle))
  }
  if (matches.length === 0) throw new NotFoundError(`No task titled "${title}".`)

  if (matches.length > 1 && boardName) {
    const boards = await deps.cache.getBoards(deps.userId)
    const board = boards.find((b) => b.name.toLowerCase() === boardName.trim().toLowerCase())
    if (board) matches = matches.filter((t) => t.boardId === board.id)
  }

  if (matches.length > 1) {
    const [boards, cols] = await Promise.all([
      deps.cache.getBoards(deps.userId),
      deps.cache.getColumns(deps.userId),
    ])
    const boardName = new Map(boards.map((b) => [b.id, b.name]))
    const colTitle = new Map(cols.map((c) => [c.id, c.title]))
    const options = matches
      .map((t) => `"${t.title}" (${boardName.get(t.boardId) ?? '?'} / ${colTitle.get(t.columnId) ?? '?'})`)
      .join('; ')
    throw new BadRequestError(
      `Multiple tasks match "${title}": ${options}. Ask the user which one and pass boardName.`,
    )
  }

  return { task: matches[0], exact }
}

/**
 * Clarification payload returned when a mutating tool resolved its target task
 * via a loose (substring) title match. The assistant should confirm the exact
 * task with the user and re-issue the tool call using the full title.
 */
function partialMatchClarification(needle: string, resolvedTitle: string) {
  return {
    result: {
      ok: false,
      needsConfirmation: true,
      resolvedTitle,
      message: `Only one task loosely matches "${needle}": "${resolvedTitle}". Confirm with the user this is the right task, then call the tool again using the exact title "${resolvedTitle}".`,
    },
  }
}

/** Finds a subtask by its (case-insensitive) text within a task the caller owns. */
async function resolveSubtaskByText(deps: TaskToolDeps, taskId: string, text: string): Promise<Subtask> {
  const subs = await deps.tasks.listSubtasks(taskId)
  const needle = text.trim().toLowerCase()
  const match =
    subs.find((s) => s.text.toLowerCase() === needle) ??
    subs.find((s) => s.text.toLowerCase().includes(needle))
  if (!match) throw new NotFoundError(`No subtask matching "${text}" on this task.`)
  return match
}

/**
 * Finds which reminder on a task the model means. Reminders have no text to
 * fuzzy-match (unlike subtasks), so: if `remindAt` is given, match it against
 * each reminder's stored time by *parsed* value (never raw string equality —
 * the model may write "15:00" while the stored value is "15:00:00.000Z"). If
 * omitted, the task must have exactly one reminder to target unambiguously.
 */
async function resolveReminder(deps: TaskToolDeps, taskId: string, remindAt?: string): Promise<Reminder> {
  const list = await deps.tasks.listReminders(taskId)
  if (remindAt) {
    const target = new Date(toStoredDateTime(remindAt, deps.tzOffsetMinutes)).getTime()
    const match = list.find((r) => new Date(r.remindAt).getTime() === target)
    if (!match) throw new NotFoundError(`No reminder at "${remindAt}" on this task.`)
    return match
  }
  if (list.length === 0) throw new NotFoundError('This task has no reminders.')
  if (list.length > 1) {
    throw new BadRequestError(
      `This task has ${list.length} reminders. Pass remindAt to say which one (e.g. one of: ${list.map((r) => r.remindAt).join(', ')}).`,
    )
  }
  return list[0]
}

/** Resolves one of the user's own boards by (case-insensitive) name. */
async function resolveBoardByName(deps: TaskToolDeps, boardName: string) {
  const userBoards = await deps.cache.getBoards(deps.userId)
  const board = userBoards.find((b) => b.name.toLowerCase() === boardName.trim().toLowerCase())
  if (!board) throw new BadRequestError(`No board named "${boardName}".`)
  return board
}

type ResolvedTarget = { boardId: string; columnId: string }
type ClarifyTarget = { clarify: Record<string, unknown> }

/**
 * Resolves a board+column for a new task. The user must choose both — when
 * either is missing we return a clarification payload (with the available
 * options) instead of silently defaulting, so the assistant asks first.
 */
async function resolveOrClarify(
  deps: TaskToolDeps,
  boardName?: string,
  columnName?: string,
): Promise<ResolvedTarget | ClarifyTarget> {
  const userBoards = await deps.cache.getBoards(deps.userId)
  if (!userBoards.length) throw new BadRequestError('You have no boards yet. Create a board first.')

  if (!boardName) {
    const options = await Promise.all(
      userBoards.map(async (b) => ({
        board: b.name,
        columns: (await deps.columns.findByBoard(b.id)).map((c) => c.title),
      })),
    )
    return {
      clarify: {
        ok: false,
        needsClarification: true,
        message: 'Ask the user which board and column to create the task in. Do not choose one yourself.',
        boards: options,
      },
    }
  }

  const board = userBoards.find((b) => b.name.toLowerCase() === boardName.trim().toLowerCase())
  if (!board) throw new BadRequestError(`No board named "${boardName}".`)

  const cols = await deps.columns.findByBoard(board.id)
  if (!cols.length) throw new BadRequestError(`Board "${board.name}" has no columns.`)

  if (!columnName) {
    return {
      clarify: {
        ok: false,
        needsClarification: true,
        message: `Ask the user which column of "${board.name}" to use.`,
        board: board.name,
        columns: cols.map((c) => c.title),
      },
    }
  }

  const column = cols.find((c) => c.title.toLowerCase() === columnName.trim().toLowerCase())
  if (!column) throw new BadRequestError(`No column named "${columnName}" on board "${board.name}".`)

  return { boardId: board.id, columnId: column.id }
}
