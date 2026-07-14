import type { PrismaClient } from '@prisma/client'
import type { Column } from '@rumbo/shared'
import type {
  IColumnRepository,
  ColumnRecord,
  CreateColumnInput,
  UpdateColumnInput,
} from '../../domain/repositories/IColumnRepository.js'

export class PrismaColumnRepository implements IColumnRepository {
  private readonly db: PrismaClient

  constructor(db: PrismaClient) {
    this.db = db
  }

  async findAllByUser(userId: string): Promise<Column[]> {
    const rows = await this.db.column.findMany({
      where: { board: { userId } },
      orderBy: { order: 'asc' },
    })
    return rows.map(this.toColumn)
  }

  async findByBoard(boardId: string): Promise<Column[]> {
    const rows = await this.db.column.findMany({
      where: { boardId },
      orderBy: { order: 'asc' },
    })
    return rows.map(this.toColumn)
  }

  async findById(id: string): Promise<ColumnRecord | null> {
    const row = await this.db.column.findUnique({
      where: { id },
      include: { board: { select: { userId: true } } },
    })
    if (!row) return null
    return { ...this.toColumn(row), boardUserId: row.board.userId }
  }

  async countByBoard(boardId: string): Promise<number> {
    return this.db.column.count({ where: { boardId } })
  }

  async create(data: CreateColumnInput & { order: number }): Promise<Column> {
    const row = await this.db.column.create({
      data: { title: data.title, boardId: data.boardId, order: data.order },
    })
    return this.toColumn(row)
  }

  async update(id: string, data: UpdateColumnInput): Promise<Column> {
    const row = await this.db.column.update({ where: { id }, data })
    return this.toColumn(row)
  }

  async delete(id: string): Promise<void> {
    await this.db.column.delete({ where: { id } })
  }

  async reorder(columnIds: string[]): Promise<void> {
    await this.db.$transaction(
      columnIds.map((id, index) =>
        this.db.column.update({ where: { id }, data: { order: index } })
      )
    )
  }

  private toColumn(row: { id: string; title: string; boardId: string; order: number; isDone: boolean }): Column {
    return { id: row.id, title: row.title, boardId: row.boardId, order: row.order, isDone: row.isDone }
  }
}
