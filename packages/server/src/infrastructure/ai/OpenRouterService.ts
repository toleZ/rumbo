import { env } from '../../env.js'

export interface ChatMessageInput {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export class OpenRouterService {
  private readonly baseUrl = 'https://openrouter.ai/api/v1'

  async *streamChat(messages: ChatMessageInput[]): AsyncGenerator<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': env.CLIENT_URL,
        'X-Title': 'Rumbo',
      },
      body: JSON.stringify({
        model: env.OPENROUTER_MODEL,
        messages,
        stream: true,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`OpenRouter error ${response.status}: ${text}`)
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

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
        if (data === '[DONE]') return

        try {
          const parsed = JSON.parse(data)
          const text = parsed.choices?.[0]?.delta?.content
          if (text) yield text
        } catch {
          // Skip malformed chunks
        }
      }
    }
  }
}
