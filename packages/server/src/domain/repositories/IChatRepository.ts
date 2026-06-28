export interface ChatMessageRecord {
  id: string
  userId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export interface IChatRepository {
  getHistory(userId: string, limit: number): Promise<ChatMessageRecord[]>
  saveMessage(userId: string, role: 'user' | 'assistant', content: string): Promise<ChatMessageRecord>
  clearHistory(userId: string): Promise<void>
}
