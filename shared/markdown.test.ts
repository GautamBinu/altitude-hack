import { describe, expect, it } from 'vitest'
import { countLinks, markdownToPlain, parseInline, parseMarkdown, safeUrl, type Block, type Inline } from './markdown'

/** Every string the renderer would put on screen, to prove nothing is passed through as markup. */
function everything(blocks: Block[]): string {
  const walk = (nodes: Inline[]): string =>
    nodes.map((n) => (n.t === 'text' ? n.v : n.t === 'br' ? '\n' : n.t === 'link' ? `<<${n.href}>>${walk(n.c)}` : walk(n.c))).join('')
  return blocks.map((b) => (b.t === 'ul' || b.t === 'ol' ? b.items.map(walk).join('|') : walk(b.c))).join('\n')
}

describe('markdown', () => {
  it('makes paragraphs and keeps single line breaks', () => {
    const blocks = parseMarkdown('First line\nsecond line\n\nNew paragraph')
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toMatchObject({ t: 'p' })
    expect(everything(blocks)).toBe('First line\nsecond line\nNew paragraph')
  })

  it('reads bold, italic and nested emphasis', () => {
    expect(parseInline('a **bold** b *it* c')).toEqual([
      { t: 'text', v: 'a ' },
      { t: 'strong', c: [{ t: 'text', v: 'bold' }] },
      { t: 'text', v: ' b ' },
      { t: 'em', c: [{ t: 'text', v: 'it' }] },
      { t: 'text', v: ' c' },
    ])
    expect(parseInline('**very *loud***')[0]).toMatchObject({ t: 'strong' })
  })

  it('leaves a lone asterisk, a sum and a snake_case handle alone', () => {
    expect(parseInline('2 * 3 = 6')).toEqual([{ t: 'text', v: '2 * 3 = 6' }])
    expect(parseInline('5 * 4 * 3')).toEqual([{ t: 'text', v: '5 * 4 * 3' }])
    expect(parseInline('follow @rit_dubai_club today')).toEqual([{ t: 'text', v: 'follow @rit_dubai_club today' }])
    expect(parseInline('my_file_name')).toEqual([{ t: 'text', v: 'my_file_name' }])
  })

  it('still reads _italic_ at the edge of a word', () => {
    expect(parseInline('this is _really_ good')).toEqual([
      { t: 'text', v: 'this is ' },
      { t: 'em', c: [{ t: 'text', v: 'really' }] },
      { t: 'text', v: ' good' },
    ])
  })

  it('makes lists, numbered lists and headings', () => {
    const blocks = parseMarkdown('## When\nSaturday\n\n- one\n- two\n\n1. first\n2. second')
    expect(blocks.map((b) => b.t)).toEqual(['h', 'p', 'ul', 'ol'])
    const ul = blocks[2] as Extract<Block, { t: 'ul' }>
    expect(ul.items).toHaveLength(2)
  })

  it('makes links only for http and https addresses', () => {
    expect(parseInline('[site](https://example.com/page)')[0]).toMatchObject({ t: 'link', href: 'https://example.com/page' })
    expect(parseInline('see https://example.com.')[1]).toMatchObject({ t: 'link', href: 'https://example.com/' })
    for (const bad of ['javascript:alert(1)', 'data:text/html;base64,PHNjcmlwdD4=', 'mailto:a@b.c', 'ftp://x.y', '//evil.test', 'vbscript:x', 'JAVASCRIPT:alert(1)', ' javascript:alert(1)']) {
      expect(safeUrl(bad)).toBeNull()
      const parsed = parseInline(`[click me](${bad})`)
      expect(parsed.some((n) => n.t === 'link')).toBe(false)
    }
  })

  it('never turns text into markup: angle brackets and HTML stay as plain characters', () => {
    const evil = '<script>alert(1)</script> <img src=x onerror=alert(1)> <a href="javascript:alert(1)">x</a>'
    const blocks = parseMarkdown(evil)
    expect(blocks).toHaveLength(1)
    expect(everything(blocks)).toBe(evil)
    // The only node types are the safe ones, so the renderer has no way to produce an element from this text.
    const types = new Set<string>()
    const walk = (nodes: Inline[]) => nodes.forEach((n) => { types.add(n.t); if ('c' in n) walk(n.c) })
    for (const b of blocks) if (b.t === 'p') walk(b.c)
    expect([...types].every((t) => ['text', 'br', 'strong', 'em', 'link'].includes(t))).toBe(true)
  })

  it('does not let a link label hide a different address', () => {
    const [node] = parseInline('[https://good.example](https://evil.example/login)')
    expect(node).toMatchObject({ t: 'link', href: 'https://evil.example/login' })
  })

  it('does not recurse forever on nested brackets', () => {
    const deep = '['.repeat(500) + 'x' + '](https://a.b)'.repeat(500)
    expect(() => parseMarkdown(deep)).not.toThrow()
    expect(() => parseMarkdown('*'.repeat(5000))).not.toThrow()
    expect(() => parseMarkdown('**'.repeat(3000))).not.toThrow()
  })

  it('gives a short plain preview', () => {
    expect(markdownToPlain('## Title\n\nSome **bold** words and [a link](https://a.b).\n\n- one\n- two')).toBe('Title Some bold words and a link. one; two')
    const long = markdownToPlain('word '.repeat(100), 60)
    expect(long.length).toBeLessThanOrEqual(63)
    expect(long.endsWith('...')).toBe(true)
  })

  it('counts links written either way', () => {
    expect(countLinks('hi')).toBe(0)
    expect(countLinks('[a](https://a.b) and https://c.d and http://e.f')).toBe(3)
  })

  it('handles empty and whitespace text', () => {
    expect(parseMarkdown('')).toEqual([])
    expect(parseMarkdown('  \n\n  ')).toEqual([])
    expect(parseMarkdown('Windows\r\nline\r\n\r\nends')).toHaveLength(2)
  })
})
