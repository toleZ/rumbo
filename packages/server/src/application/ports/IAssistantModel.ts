// Port for a streaming chat model that supports tool calling. The shapes follow
// the OpenAI/OpenRouter chat-completions convention but are owned by the
// application layer so use cases never depend on a concrete provider.

export interface ToolCall {
  id: string
  name: string
  /** Raw JSON string of the function arguments, as produced by the model. */
  arguments: string
}

export interface ChatMessageInput {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  /** Present on assistant messages that requested tool calls. */
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  /** Present on tool-result messages, linking back to the assistant's call. */
  tool_call_id?: string
}

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface TurnResult {
  /** Tool calls requested by the model during this turn (empty when none). */
  toolCalls: ToolCall[]
  finishReason: string | null
}

export interface IAssistantModel {
  /**
   * Streams a single assistant turn: yields text content deltas as they arrive
   * and returns the assembled {@link TurnResult} (tool calls + finish reason).
   *
   * When an {@link AbortSignal} is provided, aborting it cancels the outbound
   * model request and makes the generator throw, allowing callers to stop
   * processing early (e.g. when the HTTP client disconnects).
   */
  streamTurn(messages: ChatMessageInput[], tools?: ToolDefinition[], signal?: AbortSignal): AsyncGenerator<string, TurnResult>
}
