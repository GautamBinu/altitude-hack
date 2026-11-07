import type { MoodResponse } from '../../shared/types'
import { db } from '../db'
import type { MoodItem } from '../domain/mood'
import { pickMood } from '../domain/moodPicks'
import { askModel, modelAvailable } from './llm'

interface Row {
  id: number
  name: string
  description: string
  category_slug: string
  price_fils: number
  prep_seconds: number
  kind: 'drink' | 'food'
  temperature: MoodItem['temperature']
  caffeine_free: number
  tags: string
  sold_out: number
  popularity: number
}

/** The menu as the suggester sees it, with how many of each item sold in the last 7 days. */
export function loadMoodItems(nowMs = Date.now()): MoodItem[] {
  const since = new Date(nowMs - 7 * 86_400_000).toISOString()
  const rows = db
    .prepare(
      `SELECT i.id, i.name, i.description, c.slug AS category_slug, i.price_fils, i.prep_seconds, i.kind, i.temperature,
              i.caffeine_free, i.tags, i.sold_out,
              COALESCE((SELECT SUM(oi.quantity) FROM order_items oi JOIN orders o ON o.id = oi.order_id
                        WHERE oi.item_id = i.id AND o.status != 'cancelled' AND o.created_at >= ?), 0) AS popularity
       FROM items i JOIN categories c ON c.id = i.category_id
       WHERE i.hidden = 0
       ORDER BY i.sort_order, i.id`,
    )
    .all(since) as Row[]
  return rows.map((r) => {
    let tags: string[] = []
    try {
      tags = (JSON.parse(r.tags) as unknown[]).filter((t): t is string => typeof t === 'string')
    } catch {
      /* an item with unreadable tags still gets scored on its other fields */
    }
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      categorySlug: r.category_slug,
      priceFils: r.price_fils,
      prepSeconds: r.prep_seconds,
      kind: r.kind,
      temperature: r.temperature,
      caffeineFree: r.caffeine_free === 1,
      tags,
      soldOut: r.sold_out === 1,
      popularity: r.popularity,
    }
  })
}

export function cleanText(text: string): string {
  return text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300)
}

/** Three picks for what the customer wrote. Uses the model when a key is set, and the local scorer otherwise or on any failure. */
export function moodPicks(rawText: string): Promise<MoodResponse> {
  return pickMood(cleanText(rawText), loadMoodItems(), modelAvailable() ? askModel : null, (error) =>
    console.warn('[mood] model unavailable, used the local scorer:', error instanceof Error ? error.message : error),
  )
}
