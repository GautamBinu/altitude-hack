import { config } from '../config'

/** How long to wait for the model before falling back to the local scorer. */
const TIMEOUT_MS = 8000

export const modelAvailable = (): boolean => config.anthropicApiKey !== null

/** One request to the Anthropic Messages API. Returns the model's text, or throws. The key never leaves this file. */
export async function askModel(system: string, user: string): Promise<string> {
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
