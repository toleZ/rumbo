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
  isError?: boolean
  retryText?: string
  /**
   * True only when the server had already reached its persistence step (i.e. the
   * SSE stream was accepted with a 200 and started) before this error occurred —
   * meaning the user message this error is attached to was already saved to chat
   * history. Retry uses this to decide whether the server should skip re-saving
   * it. Defaults to "not safe to skip" so we duplicate rather than silently lose
   * a message on retry.
   */
  messageAlreadySaved?: boolean
}

interface ChatState {
  messages: ChatMessage[]
  isStreaming: boolean
  streamingText: string
  streamingActions: ChatAction[]
  /** In-progress input text, kept here so it survives the widget being closed/reopened. */
  draft: string
  setMessages: (msgs: ChatMessage[]) => void
  addMessage: (msg: ChatMessage) => void
  addErrorMessage: (content: string, retryText?: string, messageAlreadySaved?: boolean) => void
  removeMessage: (id: string) => void
  appendStreamChunk: (text: string) => void
  addStreamAction: (action: ChatAction) => void
  setDraft: (text: string) => void
  startStreaming: () => void
  finishStreaming: () => void
  reset: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isStreaming: false,
  streamingText: '',
  streamingActions: [],
  draft: '',

  setMessages: (messages) => set({ messages }),

  setDraft: (draft) => set({ draft }),

  addMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),

  addErrorMessage: (content, retryText, messageAlreadySaved) =>
    set((state) => ({
      messages: [
        ...state.messages,
        { id: crypto.randomUUID(), role: 'assistant' as const, content, createdAt: new Date().toISOString(), isError: true, retryText, messageAlreadySaved },
      ],
    })),

  removeMessage: (id) =>
    set((state) => ({ messages: state.messages.filter((m) => m.id !== id) })),

  appendStreamChunk: (text) =>
    set((state) => ({ streamingText: state.streamingText + text })),

  addStreamAction: (action) =>
    set((state) => ({ streamingActions: [...state.streamingActions, action] })),

  startStreaming: () => set({ isStreaming: true, streamingText: '', streamingActions: [] }),

  // Wipe all chat state (incl. the draft) — called on login/logout so one user's
  // chat or in-progress text never bleeds into another's session.
  reset: () => set({ messages: [], isStreaming: false, streamingText: '', streamingActions: [], draft: '' }),

  finishStreaming: () =>
    set((state) => {
      // If no text or actions were produced (e.g. error before any chunks
      // arrived), just reset the streaming state without appending a blank
      // assistant bubble to the conversation.
      if (!state.streamingText && !state.streamingActions.length) {
        return { isStreaming: false, streamingText: '', streamingActions: [] }
      }

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
