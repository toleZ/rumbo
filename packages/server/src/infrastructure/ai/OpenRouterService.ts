import { env } from '../../env.js'
import type {
  IAssistantModel,
  ChatMessageInput,
  ToolCall,
  ToolDefinition,
  TurnResult,
} from '../../application/ports/IAssistantModel.js'

const MAX_OUTPUT_TOKENS = 1024

export class OpenRouterService implements IAssistantModel {
  private readonly baseUrl = 'https://openrouter.ai/api/v1'

  /**
   * Streams a single assistant turn. Yields text content deltas as they arrive
   * and accumulates any tool calls; the generator's *return value* is the
   * assembled {@link TurnResult}. Callers that need the tool calls must iterate
   * manually with `.next()` to read the final return value.
   *
   * An optional {@link AbortSignal} is forwarded to the outbound `fetch` call
   * so that callers (e.g. the SSE endpoint) can cancel the model request when
   * the downstream client disconnects.
   */
  async *streamTurn(
    messages: ChatMessageInput[],
    tools?: ToolDefinition[],
    signal?: AbortSignal,
  ): AsyncGenerator<string, TurnResult> {
    const response = await this.request(messages, tools, signal)

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    // Tool-call fragments arrive across multiple chunks, keyed by their index.
    const toolAcc = new Map<number, { id: string; name: string; args: string }>()
    let finishReason: string | null = null

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)
        if (data === '[DONE]') {
          return { toolCalls: collectToolCalls(toolAcc), finishReason }
        }

        try {
          const parsed = JSON.parse(data)
          const choice = parsed.choices?.[0]
          const delta = choice?.delta
          if (delta?.content) yield delta.content as string

          if (Array.isArray(delta?.tool_calls)) {
            for (const tc of delta.tool_calls) {
              const idx: number = tc.index ?? 0
              const entry = toolAcc.get(idx) ?? { id: '', name: '', args: '' }
              if (tc.id) entry.id = tc.id
              if (tc.function?.name) entry.name = tc.function.name
              if (tc.function?.arguments) entry.args += tc.function.arguments
              toolAcc.set(idx, entry)
            }
          }

          if (choice?.finish_reason) finishReason = choice.finish_reason
        } catch {
          // Skip malformed chunks
        }
      }
    }

    return { toolCalls: collectToolCalls(toolAcc), finishReason }
  }

  /** Sends the request, retrying once with the fallback model on failure. */
  private async request(messages: ChatMessageInput[], tools?: ToolDefinition[], signal?: AbortSignal): Promise<Response> {
    const response = await this.post(env.OPENROUTER_MODEL, messages, tools, signal)
    if (response.ok) return response

    if (env.OPENROUTER_FALLBACK_MODEL && env.OPENROUTER_FALLBACK_MODEL !== env.OPENROUTER_MODEL) {
      const fallback = await this.post(env.OPENROUTER_FALLBACK_MODEL, messages, tools, signal)
      if (fallback.ok) return fallback
      const text = await fallback.text()
      throw new Error(`OpenRouter fallback error ${fallback.status}: ${text}`)
    }

    const text = await response.text()
    throw new Error(`OpenRouter error ${response.status}: ${text}`)
  }

  private post(model: string, messages: ChatMessageInput[], tools?: ToolDefinition[], signal?: AbortSignal): Promise<Response> {
    return fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': env.CLIENT_URL,
        'X-Title': 'Rumbo',
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        max_tokens: MAX_OUTPUT_TOKENS,
        // Low temperature → more consistent tool-calling and less drift as the
        // conversation grows.
        temperature: 0.2,
        top_p: 0.9,
        ...(tools && tools.length ? { tools, tool_choice: 'auto' } : {}),
      }),
      signal,
    })
  }
}

function collectToolCalls(acc: Map<number, { id: string; name: string; args: string }>): ToolCall[] {
  return [...acc.values()]
    .filter((e) => e.id && e.name)
    .map((e) => ({ id: e.id, name: e.name, arguments: e.args || '{}' }))
}
