import { useEffect, useRef, useCallback } from 'react'
import { Sparkles, Send, Trash2, Loader2, Plus, Pencil, ArrowRightLeft, Mic } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { trpc } from '../../../lib/trpc'
import { useChatStore, type ChatMessage, type ChatAction } from '../../../stores/chatStore'
import { useAuthStore } from '../../../stores/authStore'
import { useSpeechRecognition } from '../../../hooks/useSpeechRecognition'
import toast from 'react-hot-toast'

const API_STREAM_URL = import.meta.env.VITE_API_STREAM_URL ?? '/api/ai/stream'

/** Must match the server's maximum message length (index.ts). */
const MAX_MESSAGE_LENGTH = 4000

const MD_COMPONENTS: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ children, className }) => {
    const isBlock = className?.startsWith('language-')
    return isBlock ? (
      <code className="block bg-black/20 rounded-[4px] px-2 py-1 text-[11px] font-mono my-1 overflow-x-auto whitespace-pre">{children}</code>
    ) : (
      <code className="bg-black/20 rounded-[3px] px-1 text-[11px] font-mono">{children}</code>
    )
  },
  pre: ({ children }) => <pre className="my-1">{children}</pre>,
  ul: ({ children }) => <ul className="list-disc pl-4 mb-1 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-4 mb-1 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  h1: ({ children }) => <h1 className="font-bold text-sm mb-1">{children}</h1>,
  h2: ({ children }) => <h2 className="font-semibold text-sm mb-1">{children}</h2>,
  h3: ({ children }) => <h3 className="font-semibold text-xs mb-0.5">{children}</h3>,
  blockquote: ({ children }) => <blockquote className="border-l-2 border-current/30 pl-2 opacity-80 my-1">{children}</blockquote>,
  a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="underline opacity-80 hover:opacity-100">{children}</a>,
  hr: () => <hr className="border-current/20 my-1" />,
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
      {content}
    </ReactMarkdown>
  )
}

const ACTION_ICONS: Record<ChatAction['verb'], LucideIcon> = {
  created: Plus,
  updated: Pencil,
  moved: ArrowRightLeft,
  deleted: Trash2,
}

function ActionChips({ actions }: { actions: ChatAction[] }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-1 mb-1.5">
      {actions.map((a, i) => {
        const Icon = ACTION_ICONS[a.verb]
        return (
          <div
            key={i}
            className="flex items-center gap-1.5 text-[11px] text-[var(--label-2)] bg-[var(--surface)] border border-[var(--sep)] rounded-[6px] px-2 py-1"
          >
            <Icon className="w-3 h-3 shrink-0" style={{ color: 'var(--accent)' }} />
            <span className="font-medium">{t(`ring.aiAction.${a.verb}`)}</span>
            <span className="truncate">"{a.title}"</span>
          </div>
        )
      })}
    </div>
  )
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] px-3 py-2 rounded-[10px] text-sm leading-relaxed break-words ${
          isUser
            ? 'bg-[var(--accent)] text-white rounded-br-[3px] whitespace-pre-wrap'
            : 'bg-[var(--surface-2)] text-[var(--label)] rounded-bl-[3px]'
        }`}
      >
        {isUser ? (
          msg.content
        ) : (
          <>
            {msg.actions && msg.actions.length > 0 && <ActionChips actions={msg.actions} />}
            <MarkdownContent content={msg.content} />
          </>
        )}
      </div>
    </div>
  )
}

function StreamingBubble({ text, actions }: { text: string; actions: ChatAction[] }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] px-3 py-2 rounded-[10px] rounded-bl-[3px] text-sm leading-relaxed bg-[var(--surface-2)] text-[var(--label)] break-words">
        {actions.length > 0 && <ActionChips actions={actions} />}
        {text ? <MarkdownContent content={text} /> : (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--label-3)] animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--label-3)] animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--label-3)] animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        )}
      </div>
    </div>
  )
}

export function AIAssistantWidget() {
  const { t, i18n } = useTranslation()
  const { messages, isStreaming, streamingText, streamingActions, draft, setMessages, addMessage, appendStreamChunk, addStreamAction, setDraft, startStreaming, finishStreaming } = useChatStore()
  const accessToken = useAuthStore((s) => s.accessToken)
  const utils = trpc.useUtils()

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Auto-size the textarea whenever the draft content changes. This runs after
  // React has flushed the new `value` to the DOM, so `scrollHeight` is accurate
  // regardless of whether the change came from typing, voice input, or clear.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 80)}px`
  }, [draft])

  // Speech-to-text dictation → append recognized text to the draft.
  // Stops automatically when the draft reaches the server's max message length.
  // We use a ref for stopVoice inside the callback to avoid a circular
  // reference (the callback is passed to the hook that returns stopVoice).
  const stopVoiceRef = useRef<() => void>(() => {})
  const { supported: voiceSupported, listening, start: startVoice, stop: stopVoice } = useSpeechRecognition(
    useCallback((text: string) => {
      const current = useChatStore.getState().draft
      const combined = current ? `${current} ${text}` : text
      if (combined.length > MAX_MESSAGE_LENGTH) {
        setDraft(combined.slice(0, MAX_MESSAGE_LENGTH))
        // Stop listening once the limit is reached so we don't silently discard speech.
        stopVoiceRef.current()
        toast.error(t('ring.aiDraftLimit'))
      } else {
        setDraft(combined)
      }
    }, [setDraft, t]),
    useCallback((error: string) => {
      if (error === 'not-allowed' || error === 'service-not-allowed') toast.error(t('ring.aiVoiceDenied'))
    }, [t]),
  )
  stopVoiceRef.current = stopVoice
  const recLang = i18n.language === 'es' ? 'es-ES' : 'en-US'

  const historyQuery = trpc.ai.history.useQuery(undefined, { staleTime: Infinity })
  const clearMutation = trpc.ai.clearHistory.useMutation({
    onSuccess: () => {
      setMessages([])
      // Also clear the cached history; otherwise reopening the widget repopulates
      // the (now-empty) store from the stale cache and the messages "come back".
      utils.ai.history.setData(undefined, [])
    },
    onError: () => toast.error(t('ring.aiError')),
  })

  // Populate messages from DB on first load
  useEffect(() => {
    if (historyQuery.data && messages.length === 0) {
      setMessages(
        historyQuery.data.map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          createdAt: m.createdAt,
        }))
      )
    }
  }, [historyQuery.data])

  // Scroll to bottom whenever messages or streaming text change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, streamingText])

  const sendMessage = useCallback(async () => {
    const text = draft.trim()
    if (!text || isStreaming || !accessToken) return

    stopVoice()
    setDraft('')

    // Optimistic user message
    addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    })
    startStreaming()

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch(API_STREAM_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: text,
          // Let the server place relative dates ("tomorrow") on the correct
          // calendar day in the user's timezone.
          tzOffset: new Date().getTimezoneOffset(),
          today: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10),
        }),
        signal: controller.signal,
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let mutated = false
      let streamError: string | false = false

      const settle = () => {
        finishStreaming()
        // Refresh caches so the board reflects AI-driven changes (tasks, columns,
        // labels, and task comments).
        if (mutated) {
          utils.tasks.invalidate()
          utils.columns.invalidate()
          utils.labels.invalidate()
          utils.comments.invalidate()
        }
        // Suppress the error toast when a change already succeeded this turn:
        // the action chips + cache refresh convey success, so a "failed" toast
        // would be misleading (and prompt a duplicate retry).
        if (streamError && !mutated) toast.error(streamError === 'rate_limit' ? t('ring.aiRateLimit') : t('ring.aiError'))
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6)
          if (data === '[DONE]') {
            settle()
            return
          }
          try {
            const parsed = JSON.parse(data)
            if (parsed.type === 'error' || parsed.error) {
              streamError = parsed.reason ?? 'unknown'
            } else if (parsed.type === 'action') {
              mutated = true
              addStreamAction({ verb: parsed.verb, title: parsed.title })
            } else if (parsed.text) {
              // type === 'text' (or legacy text-only payload)
              appendStreamChunk(parsed.text)
            }
          } catch {
            // Skip malformed lines
          }
        }
      }

      settle()
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      finishStreaming()
      toast.error(t('ring.aiError'))
    }
  }, [draft, isStreaming, accessToken, addMessage, startStreaming, appendStreamChunk, addStreamAction, setDraft, stopVoice, finishStreaming, utils, t])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const isEmpty = messages.length === 0 && !isStreaming

  return (
    <div className="bg-[var(--surface)] rounded-[14px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-[var(--sep)] w-72 overflow-hidden flex flex-col" style={{ height: '380px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--sep)] shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 shrink-0" style={{ color: 'var(--accent)' }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
            {t('ring.aiAssistant', 'AI Assistant')}
          </span>
        </div>
        <button
          onClick={() => clearMutation.mutate()}
          disabled={clearMutation.isPending || isEmpty}
          className="p-1 rounded-[6px] text-[var(--label-3)] hover:text-[var(--label-2)] hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title={t('ring.aiClear', 'Clear history')}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {historyQuery.isLoading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--label-3)]" />
          </div>
        ) : isEmpty ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-xs text-[var(--label-3)] text-center px-4">
              {t('ring.aiEmpty', 'Ask me about your tasks, or tell me to create, update, or delete them.')}
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            {isStreaming && <StreamingBubble text={streamingText} actions={streamingActions} />}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 px-3 py-3 border-t border-[var(--sep)]">
        {draft.length > MAX_MESSAGE_LENGTH * 0.8 && (
          <div className={`text-[10px] text-right mb-1 ${draft.length >= MAX_MESSAGE_LENGTH ? 'text-red-500 font-medium' : 'text-[var(--label-3)]'}`}>
            {draft.length}/{MAX_MESSAGE_LENGTH}
          </div>
        )}
        <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder={t('ring.aiPlaceholder', 'Ask me anything...')}
          disabled={isStreaming}
          className="flex-1 resize-none text-sm bg-[var(--surface-2)] border border-[var(--sep)] rounded-[8px] px-3 py-2 text-[var(--label)] placeholder:text-[var(--label-3)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50 leading-snug overflow-hidden"
          style={{ minHeight: '36px' }}
        />
        {voiceSupported && (
          <button
            onClick={() => (listening ? stopVoice() : startVoice(recLang))}
            disabled={isStreaming}
            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border transition-[background-color,transform] duration-[140ms] hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100 ${
              listening
                ? 'bg-red-500 border-red-500 animate-pulse'
                : 'bg-[var(--surface-2)] border-[var(--sep)] hover:bg-[var(--surface)]'
            }`}
            title={listening ? t('ring.aiVoiceStop', 'Stop dictation') : t('ring.aiVoiceStart', 'Voice input')}
            aria-pressed={listening}
          >
            <Mic className={`w-3.5 h-3.5 ${listening ? 'text-white' : 'text-[var(--label-2)]'}`} />
          </button>
        )}
        <button
          onClick={sendMessage}
          disabled={!draft.trim() || isStreaming}
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-[background-color,transform] duration-[140ms] hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
          style={{ background: 'var(--accent)' }}
          title={t('ring.aiSend', 'Send')}
        >
          {isStreaming ? (
            <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5 text-white" style={{ marginLeft: '1px' }} />
          )}
        </button>
        </div>
      </div>
    </div>
  )
}
