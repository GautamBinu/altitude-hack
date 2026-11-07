/*
 * A deliberately small markdown reader for event and club posts. It turns text into a tree, never into HTML,
 * so there is nothing to inject: the browser draws the tree as React elements, which escape every character.
 *
 * Supported: paragraphs, line breaks, # headings, - and 1. lists, **bold**, *italic*, [text](https://link)
 * and bare https:// links. Anything else, including raw HTML, is shown as plain text.
 */

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'br' }
  | { t: 'strong'; c: Inline[] }
  | { t: 'em'; c: Inline[] }
  | { t: 'link'; href: string; c: Inline[] }

export type Block =
  | { t: 'p'; c: Inline[] }
  | { t: 'h'; c: Inline[] }
  | { t: 'ul'; items: Inline[][] }
  | { t: 'ol'; items: Inline[][] }

const URL_AT_START = /^https?:\/\/[^\s<>"'()[\]]{1,300}/i
const MAX_DEPTH = 3

/** Only plain web addresses may become links. No javascript:, data:, mailto: or anything else. */
export function safeUrl(url: string): string | null {
  const text = url.trim()
  if (text.length > 300 || !/^https?:\/\/[^\s<>"']+$/i.test(text)) return null
  try {
    const parsed = new URL(text)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null
  } catch {
    return null
  }
}

function pushText(out: Inline[], text: string): void {
  if (!text) return
  const last = out[out.length - 1]
  if (last?.t === 'text') last.v += text
  else out.push({ t: 'text', v: text })
}

/** Reads one line of text into bold, italic, links and plain text. */
export function parseInline(source: string, depth = 0): Inline[] {
  const out: Inline[] = []
  let i = 0
  while (i < source.length) {
    const rest = source.slice(i)

    // [text](https://address)
    if (rest[0] === '[' && depth < MAX_DEPTH) {
      const close = rest.indexOf('](')
      const end = close === -1 ? -1 : rest.indexOf(')', close + 2)
      if (close > 0 && end !== -1) {
        const href = safeUrl(rest.slice(close + 2, end))
        const label = rest.slice(1, close)
        if (href && label.trim()) {
          out.push({ t: 'link', href, c: parseInline(label, depth + 1) })
          i += end + 1
          continue
        }
      }
    }

    // **bold**
    if (rest.startsWith('**') && depth < MAX_DEPTH) {
      const end = rest.indexOf('**', 2)
      if (end > 2) {
        out.push({ t: 'strong', c: parseInline(rest.slice(2, end), depth + 1) })
        i += end + 2
        continue
      }
    }

    // *italic* or _italic_. An underscore only counts at the edge of a word, so rit_dubai_club stays as typed.
    if ((rest[0] === '*' || rest[0] === '_') && depth < MAX_DEPTH && rest[1] && rest[1] !== ' ' && rest[1] !== rest[0]) {
      const wordChar = /[A-Za-z0-9]/
      const startsWord = rest[0] === '*' || i === 0 || !wordChar.test(source[i - 1])
      const end = startsWord ? rest.indexOf(rest[0], 1) : -1
      const endsWord = end > 1 && (rest[0] === '*' || !wordChar.test(rest[end + 1] ?? ''))
      if (end > 1 && endsWord && rest[end - 1] !== ' ') {
        out.push({ t: 'em', c: parseInline(rest.slice(1, end), depth + 1) })
        i += end + 1
        continue
      }
    }

    // A bare https:// address.
    const bare = (i === 0 || /\s/.test(source[i - 1])) && URL_AT_START.exec(rest)
    if (bare) {
      const trimmed = bare[0].replace(/[.,;:!?]+$/, '')
      const href = safeUrl(trimmed)
      if (href) {
        out.push({ t: 'link', href, c: [{ t: 'text', v: trimmed }] })
        i += trimmed.length
        continue
      }
    }

    pushText(out, rest[0])
    i += 1
  }
  return out
}

function lines(inline: string): Inline[] {
  const out: Inline[] = []
  inline.split('\n').forEach((line, index) => {
    if (index > 0) out.push({ t: 'br' })
    out.push(...parseInline(line))
  })
  return out
}

const BULLET = /^\s*[-*]\s+(.*)$/
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = []
  const text = source.replace(/\r\n?/g, '\n').trim()
  if (!text) return blocks

  for (const chunk of text.split(/\n{2,}/)) {
    const rows = chunk.split('\n')

    // Heading on the first line, then whatever follows as its own paragraph.
    const heading = /^#{1,3}\s+(.+)$/.exec(rows[0])
    if (heading) {
      blocks.push({ t: 'h', c: parseInline(heading[1].trim()) })
      const after = rows.slice(1).join('\n').trim()
      if (after) blocks.push(...parseMarkdown(after))
      continue
    }

    if (rows.every((r) => BULLET.test(r))) {
      blocks.push({ t: 'ul', items: rows.map((r) => parseInline(BULLET.exec(r)![1])) })
      continue
    }
    if (rows.every((r) => NUMBERED.test(r))) {
      blocks.push({ t: 'ol', items: rows.map((r) => parseInline(NUMBERED.exec(r)![1])) })
      continue
    }
    blocks.push({ t: 'p', c: lines(chunk) })
  }
  return blocks
}

function inlineText(nodes: Inline[]): string {
  return nodes
    .map((n) => (n.t === 'text' ? n.v : n.t === 'br' ? ' ' : inlineText(n.c)))
    .join('')
}

/** The words only, on one line, for a card's preview. */
export function markdownToPlain(source: string, max = 160): string {
  const flat = parseMarkdown(source)
    .map((b) => (b.t === 'ul' || b.t === 'ol' ? b.items.map(inlineText).join('; ') : inlineText(b.c)))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max)
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 30)).replace(/[,;:\s]+$/, '') + '...'
}

/** How many web addresses are in the text, written either way. Used to turn away link spam. */
export function countLinks(source: string): number {
  return (source.match(/https?:\/\//gi) ?? []).length
}
