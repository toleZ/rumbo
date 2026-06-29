import { create } from 'zustand'

export interface ChatAction {
  verb: 'created' | 'updated' | 'moved' | 'deleted'
  title: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  /** Task actions the assistant performed while producing this message. */
  actions?: ChatAction[]
}

interface ChatState {
  messages: ChatMessage[]
  isStreaming: boolean
  streamingText: string
  streamingActions: ChatAction[]
  setMessages: (msgs: ChatMessage[]) => void
  addMessage: (msg: ChatMessage) => void
  appendStreamChunk: (text: string) => void
  addStreamAction: (action: ChatAction) => void
  startStreaming: () => void
  finishStreaming: () => void
  reset: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isStreaming: false,
  streamingText: '',
  streamingActions: [],

  setMessages: (messages) => set({ messages }),

  addMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),

  appendStreamChunk: (text) =>
    set((state) => ({ streamingText: state.streamingText + text })),

  addStreamAction: (action) =>
    set((state) => ({ streamingActions: [...state.streamingActions, action] })),

  startStreaming: () => set({ isStreaming: true, streamingText: '', streamingActions: [] }),

  // Wipe all chat state — called on login/logout so one user's chat never bleeds
  // into another's session.
  reset: () => set({ messages: [], isStreaming: false, streamingText: '', streamingActions: [] }),

  finishStreaming: () =>
    set((state) => {
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: state.streamingText,
        createdAt: new Date().toISOString(),
        actions: state.streamingActions.length ? state.streamingActions : undefined,
      }
      return {
        messages: [...state.messages, assistantMsg],
        isStreaming: false,
        streamingText: '',
        streamingActions: [],
      }
    }),
}))
