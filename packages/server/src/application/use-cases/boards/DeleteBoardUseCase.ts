import { NotFoundError, BadRequestError } from '../../../domain/errors.js'
import type { IBoardRepository } from '../../../domain/repositories/IBoardRepository.js'
import type { IAuthRepository } from '../../../domain/repositories/IAuthRepository.js'

export class DeleteBoardUseCase {
  private readonly boards: IBoardRepository
  private readonly auth?: IAuthRepository

  constructor(boards: IBoardRepository, auth?: IAuthRepository) {
    this.boards = boards
    this.auth = auth
  }

  async execute(userId: string, id: string): Promise<void> {
    const board = await this.boards.findById(id)
    if (!board || board.userId !== userId) {
      throw new NotFoundError('Board not found')
    }
    // Count must be checked after ownership is confirmed and serially so that
    // concurrent delete requests cannot both see count=2 and both succeed,
    // leaving the user with 0 boards.
    const count = await this.boards.countByUser(userId)
    if (count <= 1) {
      throw new BadRequestError('Cannot delete the last board')
    }

    await this.boards.delete(id)

    // Prune the deleted board from the user's Google Calendar sync-board allowlist, if
    // present — otherwise a stale id lingers there forever, permanently preventing that
    // list from ever collapsing back to "no restriction" (see SettingsPage.tsx's
    // checkedBoardIds/toggleSyncBoard, which relies on it staying accurate).
    if (this.auth) {
      const user = await this.auth.findUserById(userId)
      if (user && user.googleSyncBoardIds.includes(id)) {
        await this.auth.updateGoogleSyncSettings(userId, {
          syncBoardIds: user.googleSyncBoardIds.filter((boardId) => boardId !== id),
        })
      }
    }
  }
}
