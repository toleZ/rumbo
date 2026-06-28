import type { IChatRepository, ChatMessageRecord } from '../../../domain/repositories/IChatRepository.js'

export class GetChatHistoryUseCase {
  private readonly chat: IChatRepository

  constructor(chat: IChatRepository) {
    this.chat = chat
  }

  execute(userId: string): Promise<ChatMessageRecord[]> {
    return this.chat.getHistory(userId, 50)
  }
}

export class ClearChatHistoryUseCase {
  private readonly chat: IChatRepository

  constructor(chat: IChatRepository) {
    this.chat = chat
  }

  execute(userId: string): Promise<void> {
    return this.chat.clearHistory(userId)
  }
}
