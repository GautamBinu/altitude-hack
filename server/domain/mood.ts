import type { MoodPick } from '../../shared/types'
import {
  ADJECTIVES,
  BREAKERS,
  CATEGORY_TRAITS,
  CHEAP_PRICE_FILS,
  FILLERS,
  NEGATORS,
  QUICK_PREP_SECONDS,
  RULES,
  STOP_WORDS,
  type Rule,
  type Weights,
} from './moodLexicon'

/*
 * The local "What are you in the mood for?" scorer. It needs no network and no key, so the suggester
 * always works. It reads the customer's words against a lexicon (moodLexicon.ts), scores every menu
 * item by its tags, and writes the one-line reason only from tags the item really has.
 */

export interface MoodItem {
  id: number
  name: string
  description: string
  categorySlug: string
  priceFils: number
  prepSeconds: number
  kind: 'drink' | 'food'
  temperature: 'hot' | 'iced' | 'both' | 'none'
  caffeineFree: boolean
  tags: string[]
  soldOut: boolean
  /** Units ordered recently. Breaks ties and fills the list when the text says little. */
  popularity: number
}

export interface Suggestion {
  picks: MoodPick[]
  matched: boolean
  note: string | null
}

/** Lower case, apostrophes dropped, hyphens as spaces. Words and the punctuation that ends a clause. */
export function tokenize(text: string): string[] {
  const cleaned = text
    .toLowerCase()
    .replace(/[\u2018\u2019`']/g, '')
    .replace(/-/g, ' ')
    .replace(/&/g, ' and ')
  return cleaned.match(/[a-z0-9]+|[,.;:!?\n]/g) ?? []
}

const isWord = (token: string): boolean => /^[a-z0-9]/.test(token)

/** Everything we know about an item as a set of tags, including the ones worked out from its fields. */
export function traitsOf(item: MoodItem): Set<string> {
  const traits = new Set(item.tags.map((t) => t.toLowerCase()))
  traits.add(item.kind)
  if (item.temperature === 'hot' || item.temperature === 'both') traits.add('hot')
  if (item.temperature === 'iced' || item.temperature === 'both') traits.add('iced')
  traits.add(item.caffeineFree ? 'caffeine-free' : 'caffeinated')
  for (const trait of CATEGORY_TRAITS[item.categorySlug] ?? []) traits.add(trait)
  if (item.kind === 'drink' && item.prepSeconds <= QUICK_PREP_SECONDS) traits.add('quick')
  if (item.priceFils <= CHEAP_PRICE_FILS) traits.add('cheap')
  return traits
}

interface Signal {
  rule: Rule
  negated: boolean
  /** Positive: look for it. Negative: steer away from it. */
  effects: Weights
}

interface NameWord {
  word: string
  negated: boolean
}

export interface Interpretation {
  signals: Signal[]
  nameWords: NameWord[]
  priceCapFils: number | null
  caffeineFree: boolean
  wantTemperature: 'hot' | 'iced' | null
}

const PHRASES = RULES.flatMap((rule) => rule.words.map((word) => ({ rule, parts: word.split(' ') })))

/** True when the word at `start` sits under a "not": "not too sweet", "dont really want anything heavy". */
function negatedAt(tokens: string[], start: number): boolean {
  for (let k = start - 1, steps = 0; k >= 0 && steps < 5; k--, steps++) {
    const token = tokens[k]
    if (NEGATORS.has(token)) return true
    if (FILLERS.has(token) && !BREAKERS.has(token)) continue
    return false
  }
  return false
}

function effectsFor(rule: Rule, negated: boolean): Weights | null {
  const out: Weights = {}
  const importance = rule.weight ?? 1
  const add = (weights: Weights | undefined, sign: number, scale = 1) => {
    if (!weights) return
    for (const [tag, value] of Object.entries(weights)) out[tag] = (out[tag] ?? 0) + sign * value * scale * importance
  }
  if (!negated) {
    add(rule.want, 1)
    add(rule.avoid, -1)
  } else if (rule.negated) {
    add(rule.negated.want, 1)
    add(rule.negated.avoid, -1)
  } else if (rule.situational) {
    return null
  } else {
    add(rule.want, -1, 0.8)
  }
  return out
}

const PRICE_CAP = /\b(?:under|below|less than|max|maximum|within|up to|at most|no more than|cheaper than)(?: aed)? (\d{1,3})\b/

export function interpret(text: string): Interpretation {
  const tokens = tokenize(text.slice(0, 400))

  // Find every phrase, then take the longest first so "cold brew" is not read as "cold" and "brew".
  const found: { rule: Rule; start: number; length: number }[] = []
  for (let i = 0; i < tokens.length; i++) {
    for (const { rule, parts } of PHRASES) {
      if (parts.every((part, k) => tokens[i + k] === part)) found.push({ rule, start: i, length: parts.length })
    }
  }
  found.sort((a, b) => b.length - a.length || a.start - b.start)

  const consumed = new Array<boolean>(tokens.length).fill(false)
  const seen = new Set<string>()
  const signals: Signal[] = []
  for (const { rule, start, length } of found) {
    if (consumed.slice(start, start + length).some(Boolean)) continue
    for (let k = start; k < start + length; k++) consumed[k] = true
    if (seen.has(rule.id)) continue
    seen.add(rule.id)
    const negated = negatedAt(tokens, start)
    const effects = effectsFor(rule, negated)
    if (effects) signals.push({ rule, negated, effects })
  }

  const nameWords: NameWord[] = []
  const seenWords = new Set<string>()
  tokens.forEach((token, i) => {
    if (!isWord(token) || token.length < 3 || /^\d+$/.test(token) || STOP_WORDS.has(token) || seenWords.has(token)) return
    seenWords.add(token)
    nameWords.push({ word: token, negated: negatedAt(tokens, i) })
  })

  const cap = PRICE_CAP.exec(tokens.filter(isWord).join(' '))
  const sum = (tag: string) => signals.reduce((total, s) => total + (s.effects[tag] ?? 0), 0)
  const hot = sum('hot')
  const iced = sum('iced')

  return {
    signals,
    nameWords,
    priceCapFils: cap ? Number(cap[1]) * 100 : null,
    caffeineFree: signals.some((s) => s.rule.caffeineFree && !s.negated),
    wantTemperature: iced > hot + 0.5 ? 'iced' : hot > iced + 0.5 ? 'hot' : null,
  }
}

const stem = (word: string): string => (word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word)
const wordsOf = (text: string): Set<string> => new Set(tokenize(text).filter(isWord).map(stem))

interface Scored {
  item: MoodItem
  score: number
  /** How much each tag added, for writing the reason. */
  gains: Map<string, number>
  /** What the item honours that the customer ruled out, such as "not too sweet". */
  notes: string[]
  /** The signal that did the most for this item. */
  bestSignal: Signal | null
  nameHit: string | null
}

function scoreItem(item: MoodItem, interp: Interpretation, maxPopularity: number): Scored {
  const traits = traitsOf(item)
  const gains = new Map<string, number>()
  const notes: string[] = []
  let score = 0
  let bestSignal: Signal | null = null
  let bestValue = 0

  for (const signal of interp.signals) {
    let value = 0
    for (const [tag, weight] of Object.entries(signal.effects)) {
      if (!traits.has(tag)) continue
      value += weight
      if (weight > 0) gains.set(tag, (gains.get(tag) ?? 0) + weight)
    }
    score += value
    if (value > bestValue && signal.rule.because) {
      bestValue = value
      bestSignal = signal
    }
    if (signal.negated && signal.rule.notAdjective) {
      const ruledOut = Object.entries(signal.effects).filter(([, weight]) => weight < 0).map(([tag]) => tag)
      if (ruledOut.length > 0 && ruledOut.every((tag) => !traits.has(tag))) notes.push(signal.rule.notAdjective)
    }
  }

  // Words that appear in the item's own name or description.
  const nameWords = wordsOf(item.name)
  const descriptionWords = wordsOf(item.description)
  let nameHit: string | null = null
  for (const { word, negated } of interp.nameWords) {
    const key = stem(word)
    if (nameWords.has(key)) {
      score += negated ? -2.5 : 2.5
      if (!negated && !nameHit) nameHit = word
    } else if (descriptionWords.has(key) && !negated) {
      score += 0.7
      nameHit ??= word
    }
  }

  // Food only when the text asks for food.
  const asksForFood = interp.signals.some((s) => (s.effects.food ?? 0) > 0) || (nameHit !== null && item.kind === 'food')
  if (item.kind === 'food' && !asksForFood) score -= 5

  // A hot-only drink is no use to someone who asked for iced, and the other way round.
  if (interp.wantTemperature === 'iced' && item.temperature === 'hot') score -= 3
  if (interp.wantTemperature === 'hot' && item.temperature === 'iced') score -= 3

  score += (0.8 * item.popularity) / maxPopularity
  return { item, score, gains, notes, bestSignal, nameHit }
}

const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

function firstSentence(text: string): string {
  const match = /^[^.!?]*[.!?]?/.exec(text.trim())
  return (match?.[0] ?? text).trim()
}

/** Flavour and texture words that can stand out an item. Claims about energy, calm or health are only made when asked for. */
const SIGNATURE_TAGS = new Set(['caramel', 'chocolatey', 'nutty', 'floral', 'fruity', 'tropical', 'tart', 'creamy', 'smooth', 'dessert', 'buttery', 'savoury', 'bitter'])

/** How many items in the pool carry each tag, so the reason can name what is special about an item. */
type TagCounts = { counts: Map<string, number>; size: number }

function reasonFor(entry: Scored, temperature: 'hot' | 'iced' | null, popularOnly: boolean, capFils: number | null, pool: TagCounts): string {
  const { item, gains, notes, bestSignal, nameHit } = entry

  if (popularOnly) {
    return item.popularity >= 3 ? `Ordered ${item.popularity} times on campus this week.` : firstSentence(item.description)
  }

  const matched = [...gains.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag)
    .filter((tag) => ADJECTIVES[tag])
    .filter((tag) => (tag === 'hot' || tag === 'iced' ? item.temperature === tag || temperature === tag : true))

  // Three picks that all say "sweet and hot" read as lazy. Lead with the one thing that sets this item apart,
  // such as caramel or chocolatey, when it is a tag few other items have.
  const traits = traitsOf(item)
  const signature = [...traits]
    .filter((tag) => SIGNATURE_TAGS.has(tag) && !matched.slice(0, 1).includes(tag))
    .map((tag) => ({ tag, share: (pool.counts.get(tag) ?? 1) / pool.size }))
    .filter((t) => t.share <= 0.25)
    .sort((a, b) => a.share - b.share || a.tag.localeCompare(b.tag))[0]?.tag

  const ordered = [...notes.map((n) => n), ...(signature ? [ADJECTIVES[signature]] : []), ...matched.map((tag) => ADJECTIVES[tag])]
  const adjectives = [...new Set(ordered)].slice(0, 2)
  const underCap = capFils != null && item.priceFils <= capFils ? `and under ${capFils / 100} AED` : null
  const because = bestSignal?.rule.because ?? null

  if (adjectives.length > 0) return `${capitalise(adjectives.join(' and '))}, ${because ?? underCap ?? 'as you asked'}.`
  if (because) return `A good pick ${because}.`
  if (underCap) return `A good pick ${underCap.replace('and ', '')}.`
  if (nameHit) return `You mentioned ${nameHit}, and this has it.`
  return firstSentence(item.description)
}

/**
 * Three drinks for what the customer wrote. Sold-out items are never suggested. If the text says
 * nothing we can read, the most ordered drinks are returned and `matched` is false.
 */
export function suggest(text: string, items: MoodItem[], limit = 3): Suggestion {
  const interp = interpret(text)
  let pool = items.filter((item) => !item.soldOut)
  if (pool.length === 0) return { picks: [], matched: false, note: null }
  const notes: string[] = []

  if (interp.priceCapFils != null) {
    const cap = interp.priceCapFils
    const under = pool.filter((item) => item.priceFils <= cap)
    if (under.length > 0) {
      pool = under
    } else {
      // Nothing fits the limit: offer the cheapest few, and say so.
      pool = [...pool].sort((a, b) => a.priceFils - b.priceFils || a.name.localeCompare(b.name)).slice(0, 6)
      notes.push(`Nothing is under ${cap / 100} AED. These are the closest.`)
    }
  }
  if (interp.caffeineFree) {
    const free = pool.filter((item) => item.caffeineFree)
    if (free.length >= limit) pool = free
  }

  const maxPopularity = Math.max(1, ...pool.map((item) => item.popularity))
  const scored = pool.map((item) => scoreItem(item, interp, maxPopularity))
  const tagPool: TagCounts = { counts: new Map(), size: pool.length }
  for (const item of pool) for (const tag of traitsOf(item)) tagPool.counts.set(tag, (tagPool.counts.get(tag) ?? 0) + 1)

  const readSomething = interp.signals.length > 0 || scored.some((s) => s.nameHit !== null) || interp.priceCapFils != null
  // Nothing but "what's popular" (or just a price limit) to go on: the order counts decide.
  const popularOnly = scored.every((s) => s.nameHit === null) && interp.signals.every((s) => s.rule.popular && Object.keys(s.effects).length === 0)
  const askedForPopular = interp.signals.length > 0 && popularOnly

  // Choose one at a time, nudging each choice away from categories already chosen so the three differ.
  const picks: MoodPick[] = []
  const remaining = [...scored]
  const chosenCategories = new Map<string, number>()
  while (picks.length < limit && remaining.length > 0) {
    const adjusted = (s: Scored) => s.score - 1 * (chosenCategories.get(s.item.categorySlug) ?? 0)
    remaining.sort((a, b) => adjusted(b) - adjusted(a) || b.item.popularity - a.item.popularity || a.item.name.localeCompare(b.item.name))
    const best = remaining.shift()!
    chosenCategories.set(best.item.categorySlug, (chosenCategories.get(best.item.categorySlug) ?? 0) + 1)
    const temperature = best.item.temperature === 'both' ? interp.wantTemperature : null
    picks.push({ itemId: best.item.id, reason: reasonFor(best, temperature, popularOnly, interp.priceCapFils, tagPool), temperature })
  }

  let note: string | null = notes[0] ?? null
  if (!readSomething) note = "That didn't give us much to go on, so here is what people on campus order most."
  else if (askedForPopular) note = 'Here is what people on campus order most.'
  return { picks, matched: readSomething, note }
}
