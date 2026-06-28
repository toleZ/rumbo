import { create } from 'zustand'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

interface ChatState {
  messages: ChatMessage[]
  isStreaming: boolean
  streamingText: string
  setMessages: (msgs: ChatMessage[]) => void
  addMessage: (msg: ChatMessage) => void
  appendStreamChunk: (text: string) => void
  startStreaming: () => void
  finishStreaming: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isStreaming: false,
  streamingText: '',

  setMessages: (messages) => set({ messages }),

  addMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),

  appendStreamChunk: (text) =>
    set((state) => ({ streamingText: state.streamingText + text })),

  startStreaming: () => set({ isStreaming: true, streamingText: '' }),

  finishStreaming: () =>
    set((state) => {
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: state.streamingText,
        createdAt: new Date().toISOString(),
      }
      return {
        messages: [...state.messages, assistantMsg],
        isStreaming: false,
        streamingText: '',
      }
    }),
}))
