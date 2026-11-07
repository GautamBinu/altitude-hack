import { parseMarkdown, type Block, type Inline } from '@shared/markdown'
import { Fragment, useMemo } from 'react'
import { cx } from '../../lib/cx'

/*
 * Draws the safe markdown tree from shared/markdown.ts. Every piece of text goes in as a React child, which
 * escapes it, and there is no dangerouslySetInnerHTML anywhere, so nothing a visitor writes can become markup.
 */

function Inlines({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((node, i) => {
        switch (node.t) {
          case 'text':
            return <Fragment key={i}>{node.v}</Fragment>
          case 'br':
            return <br key={i} />
          case 'strong':
            return (
              <strong key={i} className="font-semibold text-ink">
                <Inlines nodes={node.c} />
              </strong>
            )
          case 'em':
            return (
              <em key={i}>
                <Inlines nodes={node.c} />
              </em>
            )
          case 'link':
            return (
              <a key={i} href={node.href} target="_blank" rel="noopener noreferrer nofollow ugc" className="break-words font-semibold text-ink underline underline-offset-4">
                <Inlines nodes={node.c} />
              </a>
            )
        }
      })}
    </>
  )
}

function BlockView({ block }: { block: Block }) {
  switch (block.t) {
    case 'p':
      return (
        <p className="text-body text-ink">
          <Inlines nodes={block.c} />
        </p>
      )
    case 'h':
      return (
        <h3 className="mt-2 text-title font-semibold text-ink">
          <Inlines nodes={block.c} />
        </h3>
      )
    case 'ul':
      return (
        <ul className="ml-5 list-disc space-y-1 text-body text-ink marker:text-muted">
          {block.items.map((item, i) => (
            <li key={i}>
              <Inlines nodes={item} />
            </li>
          ))}
        </ul>
      )
    case 'ol':
      return (
        <ol className="ml-5 list-decimal space-y-1 text-body text-ink marker:text-muted">
          {block.items.map((item, i) => (
            <li key={i}>
              <Inlines nodes={item} />
            </li>
          ))}
        </ol>
      )
  }
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks = useMemo(() => parseMarkdown(text), [text])
  return (
    <div className={cx('grid gap-3', className)}>
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </div>
  )
}
