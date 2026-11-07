import type { MoodResponse } from '../../shared/types'
import { suggest, type MoodItem } from './mood'
import { buildPrompt, parseModelReply } from './moodModel'

export type Ask = (system: string, user: string) => Promise<string>

/**
 * Three picks for what the customer wrote. The local scorer always runs and always works. When a model
 * is available its picks come first, but only the ones that pass the checks in parseModelReply; the
 * scorer fills any gap. A slow, failing or confused model never shows up as an error to the customer.
 */
export async function pickMood(text: string, items: MoodItem[], ask: Ask | null, onModelError?: (error: unknown) => void): Promise<MoodResponse> {
  const local = suggest(text, items)
  if (!ask) return local

  try {
    const { system, user } = buildPrompt(items, text)
    const fromModel = parseModelReply(await ask(system, user), items)
    if (fromModel.length === 0) return local
    const taken = new Set(fromModel.map((pick) => pick.itemId))
    const picks = [...fromModel, ...local.picks.filter((pick) => !taken.has(pick.itemId))].slice(0, 3)
    return { picks, matched: true, note: null }
  } catch (error) {
    onModelError?.(error)
    return local
  }
}
