import { z } from 'zod'
import type { Task, Subtask } from '@rumbo/shared'
import { NotFoundError, BadRequestError } from '../../../domain/errors.js'
import type { IBoardRepository } from '../../../domain/repositories/IBoardRepository.js'
import type { IColumnRepository } from '../../../domain/repositories/IColumnRepository.js'
import type { ITaskRepository } from '../../../domain/repositories/ITaskRepository.js'
import type { ISubtaskRepository } from '../../../domain/repositories/ISubtaskRepository.js'
import type { ILabelRepository } from '../../../domain/repositories/ILabelRepository.js'
import type { ICommentRepository } from '../../../domain/repositories/ICommentRepository.js'
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
import type { ToolDefinition } from '../../ports/IAssistantModel.js'

const DEFAULT_LABEL_COLOR = '#6b7280'
// Cap how many tasks list_tasks returns so one call can't flood the context.
const TASK_LIST_LIMIT = 75

export interface TaskToolDeps {
  /** Always the authenticated user from the verified JWT — never from model args. */
  userId: string
  boards: IBoardRepository
  columns: IColumnRepository
  tasks: ITaskRepository
  subtasks: ISubtaskRepository
  labels: ILabelRepository
  comments: ICommentRepository
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
  const { userId, boards, columns, tasks, subtasks, labels, comments } = deps

  let args: unknown
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {}
  } catch {
    throw new BadRequestError('Invalid tool arguments (not valid JSON)')
  }

  switch (name) {
    case 'list_tasks': {
      const [all, cols, userBoards] = await Promise.all([
        new ListAllTasksUseCase(tasks).execute(userId),
        columns.findAllByUser(userId),
        boards.findAllByUser(userId),
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
      return {
        result: {
          // No internal ids exposed — tasks are referenced by title.
          tasks: shown.map((t) => {
            const labelNames = t.labels.map((id) => labelName.get(id)).filter(Boolean)
            const subs = t.subtasks.map((s) => ({ text: s.text, done: s.completed }))
            return {
              title: t.title,
              status: colTitle.get(t.columnId) ?? 'Unknown',
              priority: t.priority,
              dueDate: t.dueDate,
              scheduledDate: t.scheduledDate,
              ...(labelNames.length ? { labels: labelNames } : {}),
              ...(subs.length ? { subtasks: subs } : {}),
            }
          }),
          ...(all.length > TASK_LIST_LIMIT
            ? { note: `Showing ${TASK_LIST_LIMIT} of ${all.length} tasks; ask the user to narrow down if needed.` }
            : {}),
        },
      }
    }

    case 'list_boards': {
      const userBoards = await boards.findAllByUser(userId)
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

    case 'manage_subtask': {
      const a = manageSubtaskArgs.parse(args)
      const found = await resolveTaskByTitle(deps, a.taskTitle, a.boardName)

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
      const found = await resolveTaskByTitle(deps, a.taskTitle, a.boardName)
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
        await new UpdateTaskUseCase(tasks).execute(userId, found.id, {
          labelIds: found.labels.filter((id) => id !== label.id),
        })
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
      await new UpdateTaskUseCase(tasks).execute(userId, found.id, {
        labelIds: [...found.labels, label.id],
      })
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
      const found = await resolveTaskByTitle(deps, a.taskTitle, a.boardName)
      await new CreateCommentUseCase(tasks, comments).execute(userId, found.id, a.text)
      return {
        result: { ok: true, task: found.title },
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

/** Resolves one of the user's own boards by (case-insensitive) name. */
async function resolveBoardByName(deps: TaskToolDeps, boardName: string) {
  const userBoards = await deps.boards.findAllByUser(deps.userId)
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
