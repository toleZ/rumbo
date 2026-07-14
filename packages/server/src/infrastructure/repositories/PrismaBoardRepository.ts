import type { PrismaClient } from '@prisma/client'
import type { Board, Column } from '@rumbo/shared'
import type {
  IBoardRepository,
  BoardRecord,
  BoardWithColumns,
  CreateBoardInput,
  UpdateBoardInput,
} from '../../domain/repositories/IBoardRepository.js'

export class PrismaBoardRepository implements IBoardRepository {
  private readonly db: PrismaClient

  constructor(db: PrismaClient) {
    this.db = db
  }

  async findAllByUser(userId: string): Promise<Board[]> {
    const rows = await this.db.board.findMany({
      where: { userId },
      orderBy: { order: 'asc' },
    })
    return rows.map(this.toBoard)
  }

  async findById(id: string): Promise<BoardRecord | null> {
    const row = await this.db.board.findUnique({ where: { id } })
    if (!row) return null
    return { ...this.toBoard(row), userId: row.userId }
  }

  async countByUser(userId: string): Promise<number> {
    return this.db.board.count({ where: { userId } })
  }

  async create(userId: string, data: CreateBoardInput): Promise<BoardWithColumns> {
    const order = await this.countByUser(userId)

    const board = await this.db.board.create({
      data: {
        name: data.name,
        color: data.color ?? null,
        order,
        userId,
      },
    })

    if (data.columnTitles && data.columnTitles.length > 0) {
      // Templates always place their terminal ("Done"/"Completed"/etc.) column last —
      // mark it isDone so task-filtering features don't have to guess from the title.
      const lastIndex = data.columnTitles.length - 1
      await this.db.column.createMany({
        data: data.columnTitles.map((title, index) => ({
          title,
          order: index,
          boardId: board.id,
          isDone: index === lastIndex,
        })),
      })
    }

    const result = await this.db.board.findUniqueOrThrow({
      where: { id: board.id },
      include: { columns: { orderBy: { order: 'asc' } } },
    })

    return {
      ...this.toBoard(result),
      columns: result.columns.map(this.toColumn),
    }
  }

  async update(id: string, data: UpdateBoardInput): Promise<Board> {
    const row = await this.db.board.update({ where: { id }, data })
    return this.toBoard(row)
  }

  async delete(id: string): Promise<void> {
    await this.db.board.delete({ where: { id } })
  }

  private toBoard(row: { id: string; name: string; color: string | null; order: number; createdAt: Date }): Board {
    return {
      id: row.id,
      name: row.name,
      color: row.color,
      order: row.order,
      createdAt: row.createdAt.toISOString(),
    }
  }

  private toColumn(row: { id: string; title: string; boardId: string; order: number; isDone: boolean }): Column {
    return { id: row.id, title: row.title, boardId: row.boardId, order: row.order, isDone: row.isDone }
  }
}
