/*
 * A small client for the Gemini API's generateContent method, written against Google's REST documentation
 * (https://ai.google.dev/gemini-api/docs). It has no dependency on the app, and `fetch` is passed in, so the
 * whole request and reply handling can be tested without a key or a network.
 *
 * The API key travels in the `x-goog-api-key` header, never in the address, so it cannot end up in a log line
 * or an error message.
 */

export interface GeminiOptions {
  apiKey: string
  /** For example gemini-3.8-flash. */
  model: string
  baseUrl?: string
  system: string
  user: string
  /** A JSON schema for the reply. When it is set, the model is asked for JSON that matches it. */
  schema?: Record<string, unknown>
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

const DEFAULT_BASE = 'https://generativelanguage.googleapis.com/v1beta'

/** Model codes go into the address, so only plain ones are accepted. */
export function safeModel(model: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,60}$/.test(model)) throw new Error(`"${model}" is not a valid Gemini model name`)
  return model
}

export function geminiEndpoint(model: string, baseUrl = DEFAULT_BASE): string {
  return `${baseUrl.replace(/\/+$/, '')}/models/${encodeURIComponent(safeModel(model))}:generateContent`
}

/**
 * How much the model should think before answering. Choosing three drinks does not need long reasoning, and
 * thinking tokens count against the output limit, so keep it low. Gemini 3 and 4 use levels, and `minimal`
 * is refused by some of them, so `low` is the safe choice. Gemini 2.5 Flash uses a token budget instead.
 */
export function thinkingFor(model: string): Record<string, unknown> | undefined {
  if (/^gemini-(3|4)/.test(model)) return { thinkingLevel: 'low' }
  if (/^gemini-2\.5-flash/.test(model)) return { thinkingBudget: 0 }
  return undefined
}

export type RequestShape = 'structured' | 'plain'

/**
 * The request body. `structured` asks for JSON that matches the schema and sets the thinking level. `plain`
 * is the barest request that still works on any model: the prompt already asks for JSON, and the reply is
 * checked afterwards either way. `temperature` is left out on purpose: newer Gemini models ignore it and
 * warn.
 */
export function buildBody(options: Pick<GeminiOptions, 'system' | 'user' | 'schema' | 'model'>, shape: RequestShape): Record<string, unknown> {
  const generationConfig: Record<string, unknown> = { maxOutputTokens: 2048 }
  if (shape === 'structured') {
    if (options.schema) generationConfig.responseFormat = { text: { mimeType: 'APPLICATION_JSON', schema: options.schema } }
    const thinking = thinkingFor(options.model)
    if (thinking) generationConfig.thinkingConfig = thinking
  }
  return {
    system_instruction: { parts: [{ text: options.system }] },
    contents: [{ role: 'user', parts: [{ text: options.user }] }],
    generationConfig,
  }
}

interface GeminiReply {
  candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[]
  promptFeedback?: { blockReason?: string }
  error?: { message?: string; status?: string }
}

/** The answer text, leaving out any "thought" parts. Throws a short, key-free reason when there is no answer. */
export function readText(reply: GeminiReply): string {
  if (reply.promptFeedback?.blockReason) throw new Error(`the request was blocked (${reply.promptFeedback.blockReason})`)
  const candidate = reply.candidates?.[0]
  const text = (candidate?.content?.parts ?? [])
    .filter((p) => p.thought !== true)
    .map((p) => p.text ?? '')
    .join('')
    .trim()
  if (!text) throw new Error(`the reply was empty${candidate?.finishReason ? ` (${candidate.finishReason})` : ''}`)
  return text
}

/** What went wrong, in a line, from Google's own error body. Never includes the request. */
function describeFailure(status: number, body: GeminiReply | null): string {
  const detail = body?.error?.message?.replace(/\s+/g, ' ').trim().slice(0, 200)
  return `Gemini answered ${status}${body?.error?.status ? ` ${body.error.status}` : ''}${detail ? `: ${detail}` : ''}`
}

/**
 * Asks Gemini and returns the text of its answer. If the full request is refused as invalid (a 400, which is
 * what a model that does not know one of the newer settings returns), it is tried once more in its plainest
 * form. Any other failure, a timeout, a missing key or a rate limit, is thrown straight away so the caller can
 * fall back to the local scorer.
 */
export async function askGemini(options: GeminiOptions): Promise<string> {
  const doFetch = options.fetchImpl ?? fetch
  const url = geminiEndpoint(options.model, options.baseUrl)

  const send = async (shape: RequestShape): Promise<{ status: number; body: GeminiReply | null }> => {
    const response = await doFetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': options.apiKey },
      body: JSON.stringify(buildBody(options, shape)),
      signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
    })
    let body: GeminiReply | null = null
    try {
      body = (await response.json()) as GeminiReply
    } catch {
      /* an empty or non-JSON body */
    }
    return { status: response.status, body }
  }

  let attempt = await send('structured')
  if (attempt.status === 400 && options.schema) attempt = await send('plain')
  if (attempt.status < 200 || attempt.status >= 300) throw new Error(describeFailure(attempt.status, attempt.body))
  return readText(attempt.body ?? {})
}

/** The reply the mood suggester asks for, as a JSON schema. */
export const PICKS_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    picks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer', description: 'The id of a menu item, from the list.' },
          reason: { type: 'string', description: 'One short sentence on why it fits, under 14 words.' },
          temperature: { type: 'string', enum: ['hot', 'iced'], description: 'Only when the customer made a preference clear.' },
        },
        required: ['id', 'reason'],
      },
    },
  },
  required: ['picks'],
}
