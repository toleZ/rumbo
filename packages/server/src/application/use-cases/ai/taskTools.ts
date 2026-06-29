import { z } from 'zod'
import type { Task } from '@rumbo/shared'
import { NotFoundError, BadRequestError } from '../../../domain/errors.js'
import type { IBoardRepository } from '../../../domain/repositories/IBoardRepository.js'
import type { IColumnRepository } from '../../../domain/repositories/IColumnRepository.js'
import type { ITaskRepository } from '../../../domain/repositories/ITaskRepository.js'
import {
  CreateTaskUseCase,
  UpdateTaskUseCase,
  DeleteTaskUseCase,
  MoveTaskUseCase,
  ListAllTasksUseCase,
} from '../tasks/TaskUseCases.js'
import type { ToolDefinition } from '../../ports/IAssistantModel.js'

export interface TaskToolDeps {
  /** Always the authenticated user from the verified JWT — never from model args. */
  userId: string
  boards: IBoardRepository
  columns: IColumnRepository
  tasks: ITaskRepository
  /** Client's `Date.getTimezoneOffset()` (minutes), used to anchor bare dates to local midnight. */
  tzOffsetMinutes: number
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

const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const

// OpenAI-style tool schemas advertised to the model.
export const TASK_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'list_tasks',
      description:
        "List the current user's tasks (title, board, status/column, priority, dates). Use it to answer questions or to find the exact title of a task before updating/moving/deleting it.",
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_boards',
      description: "List the user's boards and the column (status) names within each board.",
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
  const { userId, boards, columns, tasks } = deps

  let args: unknown
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {}
  } catch {
    throw new BadRequestError('Invalid tool arguments (not valid JSON)')
  }

  switch (name) {
    case 'list_tasks': {
      const [all, cols] = await Promise.all([
        new ListAllTasksUseCase(tasks).execute(userId),
        columns.findAllByUser(userId),
      ])
      const colTitle = new Map(cols.map((c) => [c.id, c.title]))
      return {
        result: {
          // No internal ids exposed — tasks are referenced by title.
          tasks: all.map((t) => ({
            title: t.title,
            status: colTitle.get(t.columnId) ?? 'Unknown',
            priority: t.priority,
            dueDate: t.dueDate,
            scheduledDate: t.scheduledDate,
          })),
        },
      }
    }

    case 'list_boards': {
      const userBoards = await boards.findAllByUser(userId)
      const boardList = await Promise.all(
        userBoards.map(async (b) => ({
          board: b.name,
          columns: (await columns.findByBoard(b.id)).map((c) => c.title),
        })),
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
      return {
        result: { ok: true, task: { title: task.title } },
        action: { verb: 'created', title: task.title },
      }
    }

    case 'update_task': {
      const a = updateArgs.parse(args)
      const found = await resolveTaskByTitle(deps, a.taskTitle, a.boardName)
      const task = await new UpdateTaskUseCase(tasks).execute(userId, found.id, {
        title: a.title,
        description: a.description,
        priority: a.priority,
        dueDate: toStoredDate(a.dueDate, deps.tzOffsetMinutes),
        scheduledDate: toStoredDate(a.scheduledDate, deps.tzOffsetMinutes),
      })
      return {
        result: { ok: true, task: { title: task.title } },
        action: { verb: 'updated', title: task.title },
      }
    }

    case 'move_task': {
      const a = moveArgs.parse(args)
      const found = await resolveTaskByTitle(deps, a.taskTitle, a.boardName)

      const boardCols = await columns.findByBoard(found.boardId)
      const dest = boardCols.find(
        (c) => c.title.toLowerCase() === a.columnName.trim().toLowerCase(),
      )
      if (!dest) throw new BadRequestError(`No column named "${a.columnName}" on this board`)

      const boardTasks = await tasks.findByBoard(found.boardId)
      const order = boardTasks.filter((t) => t.columnId === dest.id).length
      const moved = await new MoveTaskUseCase(tasks, columns).execute(userId, found.id, dest.id, order)
      return {
        result: { ok: true, task: { title: moved.title, status: dest.title } },
        action: { verb: 'moved', title: moved.title },
      }
    }

    case 'delete_task': {
      const a = deleteArgs.parse(args)
      const found = await resolveTaskByTitle(deps, a.taskTitle, a.boardName)

      if (!a.confirmed) {
        return {
          result: {
            ok: false,
            needsConfirmation: true,
            message: `Ask the user to confirm deleting "${found.title}", then call delete_task again with confirmed=true.`,
          },
        }
      }

      await new DeleteTaskUseCase(tasks).execute(userId, found.id)
      return {
        result: { ok: true, deleted: found.title },
        action: { verb: 'deleted', title: found.title },
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

/**
 * Finds a task by its (case-insensitive) title within the user's own tasks.
 * `findAllByUser` is already user-scoped, so ownership is guaranteed. Prefers an
 * exact title match, falling back to a unique partial match. Throws a helpful
 * error when nothing matches or when the title is ambiguous (so the assistant
 * can ask the user to specify the board).
 */
async function resolveTaskByTitle(deps: TaskToolDeps, title: string, boardName?: string): Promise<Task> {
  const all = await deps.tasks.findAllByUser(deps.userId)
  const needle = title.trim().toLowerCase()

  let matches = all.filter((t) => t.title.toLowerCase() === needle)
  if (matches.length === 0) {
    matches = all.filter((t) => t.title.toLowerCase().includes(needle))
  }
  if (matches.length === 0) throw new NotFoundError(`No task titled "${title}".`)

  if (matches.length > 1 && boardName) {
    const boards = await deps.boards.findAllByUser(deps.userId)
    const board = boards.find((b) => b.name.toLowerCase() === boardName.trim().toLowerCase())
    if (board) matches = matches.filter((t) => t.boardId === board.id)
  }

  if (matches.length > 1) {
    const [boards, cols] = await Promise.all([
      deps.boards.findAllByUser(deps.userId),
      deps.columns.findAllByUser(deps.userId),
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

  return matches[0]
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
  const userBoards = await deps.boards.findAllByUser(deps.userId)
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
