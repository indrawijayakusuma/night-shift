import OpenAI from 'openai'
import { rootLogger } from './logger.js'

let client: OpenAI | null = null

export function isLlmAvailable(): boolean {
  return Boolean(process.env['OPENAI_API_KEY'] && process.env['OPENAI_API_KEY'] !== 'sk-...')
}

export function getOpenAiClient(): OpenAI {
  if (!isLlmAvailable()) {
    throw new Error('OPENAI_API_KEY is not configured')
  }
  if (!client) {
    client = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] })
  }
  return client
}

export function getModel(): string {
  return process.env['OPENAI_MODEL'] ?? 'gpt-4o-mini'
}

export interface LlmJsonResult<T> {
  data: T
  model: string
  promptTokens: number
  completionTokens: number
  durationMs: number
}

export async function callLlmJson<T>(
  systemPrompt: string,
  userPrompt: string,
): Promise<LlmJsonResult<T>> {
  const openai = getOpenAiClient()
  const model = getModel()
  const start = Date.now()

  const response = await openai.chat.completions.create({
    model,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('LLM returned empty response')
  }

  let parsed: T
  try {
    parsed = JSON.parse(content) as T
  } catch {
    rootLogger.warn('llm.json_parse_failed', { content: content.slice(0, 200) })
    throw new Error('LLM returned invalid JSON')
  }

  return {
    data: parsed,
    model,
    promptTokens: response.usage?.prompt_tokens ?? 0,
    completionTokens: response.usage?.completion_tokens ?? 0,
    durationMs: Date.now() - start,
  }
}
