import { config } from '../config'
import { askGemini, PICKS_SCHEMA } from '../domain/gemini'

/** How long to wait for the model before falling back to the local scorer. */
const TIMEOUT_MS = 10_000

export type ModelProvider = 'gemini' | 'anthropic'

/** Gemini is used when its key is set. Anthropic is the alternative when only that key is set. */
export function modelProvider(): ModelProvider | null {
  if (config.geminiApiKey) return 'gemini'
  if (config.anthropicApiKey) return 'anthropic'
  return null
}

export const modelAvailable = (): boolean => modelProvider() !== null

/** For the start-up log and the check script: which model answers, without the key. */
export function describeModel(): string {
  const provider = modelProvider()
  if (provider === 'gemini') return `Gemini (${config.geminiModel})`
  if (provider === 'anthropic') return `Anthropic (${config.anthropicModel})`
  return 'none, the local scorer answers'
}

async function askAnthropic(system: string, user: string): Promise<string> {
  if (!config.anthropicApiKey) throw new Error('no model key configured')
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.anthropicModel,
      max_tokens: 500,
      system,
      messages: [{ role: 'user', content: user }],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`model request failed with status ${response.status}`)
  const data = (await response.json()) as { content?: { type: string; text?: string }[] }
  return (data.content ?? []).filter((block) => block.type === 'text').map((block) => block.text ?? '').join('')
}

/** One request to the configured model. Returns the model's text, or throws. The key never leaves this file. */
export async function askModel(system: string, user: string): Promise<string> {
  const provider = modelProvider()
  if (provider === 'gemini') {
    return askGemini({
      apiKey: config.geminiApiKey!,
      model: config.geminiModel,
      baseUrl: config.geminiBaseUrl,
      system,
      user,
      schema: PICKS_SCHEMA,
      timeoutMs: TIMEOUT_MS,
    })
  }
  if (provider === 'anthropic') return askAnthropic(system, user)
  throw new Error('no model key configured')
}
