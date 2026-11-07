import type { MenuCategory, MenuItem } from '@shared/types'
import { Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CartBar } from '../../components/cart/CartBar'
import { CartPanel } from '../../components/cart/CartPanel'
import { ItemSheet } from '../../components/menu/ItemSheet'
import { MenuItemCard } from '../../components/menu/MenuItemCard'
import { Button } from '../../components/ui/Button'
import { inputClass } from '../../components/ui/Fields'
import { EmptyState, ErrorState } from '../../components/ui/States'
import { LoadingLine } from '../../components/ui/Art'
import { cx } from '../../lib/cx'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { useMenu } from '../../state/menu'
import { useOrders } from '../../state/orders'
import { useQueueStatus, waitSentence } from '../../state/queueStatus'

type FilterKey = 'hot' | 'iced' | 'decaf'
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'hot', label: 'Hot' },
  { key: 'iced', label: 'Iced' },
  { key: 'decaf', label: 'Caffeine free' },
]

function matches(item: MenuItem, query: string, filters: Set<FilterKey>): boolean {
  if (query) {
    const haystack = `${item.name} ${item.description}`.toLowerCase()
    if (!query.split(/\s+/).every((word) => haystack.includes(word))) return false
  }
  if (filters.has('hot') && !(item.temperature === 'hot' || item.temperature === 'both')) return false
  if (filters.has('iced') && !(item.temperature === 'iced' || item.temperature === 'both')) return false
  if (filters.has('decaf') && !item.caffeineFree) return false
  return true
}

function MenuSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <LoadingLine label="Loading the menu" />
      <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-60 animate-pulse rounded-lg border border-line bg-surface" />
        ))}
      </div>
    </div>
  )
}

export function MenuPage() {
  useDocumentTitle('Menu')
  const menu = useMenu()
  const { active } = useOrders()
  const queue = useQueueStatus()
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Set<FilterKey>>(new Set())
  const [selected, setSelected] = useState<MenuItem | null>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const trimmed = query.trim().toLowerCase()
  const visible = useMemo<MenuCategory[]>(
    () =>
      menu.categories
        .map((c) => ({ ...c, items: c.items.filter((item) => matches(item, trimmed, filters)) }))
        .filter((c) => c.items.length > 0),
    [menu.categories, trimmed, filters],
  )
  const filtering = trimmed !== '' || filters.size > 0

  // Highlight the category whose section is near the top while scrolling.
  const sectionRefs = useRef(new Map<string, HTMLElement>())
  useEffect(() => {
    if (visible.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (hit) setActiveCategory(hit.target.id.replace('cat-', ''))
      },
      { rootMargin: '-30% 0px -60% 0px' },
    )
    sectionRefs.current.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [visible])

  const toggleFilter = (key: FilterKey) =>
    setFilters((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const stickyTop = active.length > 0 ? 'top-[7rem] md:top-14' : 'top-14 md:top-0'

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_22.5rem] lg:items-start lg:gap-10">
      <div className="min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
          <h1 className="text-display-lg font-bold text-ink">Menu</h1>
          {queue && <p className="text-body-sm text-muted">{waitSentence(queue)}</p>}
        </div>

        <div className="mt-4 grid gap-3">
          <div className="relative">
            <label htmlFor="menu-search" className="sr-only">
              Search the menu
            </label>
            <Search
              size={20}
              strokeWidth={1.75}
              className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              id="menu-search"
              type="search"
              inputMode="search"
              autoComplete="off"
              placeholder="Search the menu"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={cx(inputClass, 'border-control pl-11 [&::-webkit-search-cancel-button]:hidden', query && 'pr-12')}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute top-1/2 right-1 grid size-11 -translate-y-1/2 place-items-center rounded-md text-muted hover:text-ink"
              >
                <X size={18} strokeWidth={1.75} aria-hidden="true" />
              </button>
            )}
          </div>

          <div role="group" aria-label="Filter the menu" className="flex flex-wrap gap-2">
            {FILTERS.map(({ key, label }) => {
              const on = filters.has(key)
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleFilter(key)}
                  className={cx(
                    'min-h-11 rounded-md border px-4 text-body-sm font-semibold transition-colors duration-150',
                    on ? 'border-accent bg-raised text-ink shadow-[inset_0_0_0_1px_var(--c-accent)]' : 'border-control text-ink hover:bg-raised',
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {menu.status === 'loading' && <div className="mt-6"><MenuSkeleton /></div>}

        {menu.status === 'error' && (
          <ErrorState className="mt-6" message={menu.error ?? ''} offline={menu.offline} onRetry={menu.reload} title="The menu didn't load" />
        )}

        {menu.status === 'ready' && (
          <>
            {visible.length > 0 && !filtering && (
              <nav
                aria-label="Menu categories"
                className={cx('sticky z-10 -mx-4 mt-5 border-b border-line bg-bg px-4 md:-mx-8 md:px-8 lg:mr-0 lg:pr-0', stickyTop)}
              >
                <ul className="flex gap-1 overflow-x-auto py-1.5 [scrollbar-width:none]">
                  {visible.map((category) => {
                    const on = (activeCategory ?? visible[0]?.slug) === category.slug
                    return (
                      <li key={category.id} className="shrink-0">
                        <button
                          type="button"
                          aria-current={on ? 'true' : undefined}
                          onClick={() =>
                            document
                              .getElementById(`cat-${category.slug}`)
                              ?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
                          }
                          className={cx(
                            'min-h-11 rounded-md px-3.5 text-body-sm font-semibold whitespace-nowrap transition-colors',
                            on ? 'bg-raised text-ink shadow-[inset_0_-2px_0_var(--c-accent)]' : 'text-muted hover:text-ink',
                          )}
                        >
                          {category.name}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </nav>
            )}

            {visible.length === 0 ? (
              <EmptyState
                className="mt-6"
                title={trimmed ? `Nothing matches "${query.trim()}"` : 'Nothing fits those filters'}
                action={
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => {
                      setQuery('')
                      setFilters(new Set())
                    }}
                  >
                    Clear search and filters
                  </Button>
                }
              >
                Try a shorter word, or turn a filter off.
              </EmptyState>
            ) : (
              visible.map((category) => (
                <section
                  key={category.id}
                  id={`cat-${category.slug}`}
                  ref={(el) => {
                    if (el) sectionRefs.current.set(category.slug, el)
                    else sectionRefs.current.delete(category.slug)
                  }}
                  aria-labelledby={`cat-title-${category.slug}`}
                  className="scroll-mt-32 pt-8 first:pt-6"
                >
                  <h2 id={`cat-title-${category.slug}`} className="mb-4 text-headline font-semibold text-ink">
                    {category.name}
                  </h2>
                  <ul className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                    {category.items.map((item) => (
                      <li key={item.id}>
                        <MenuItemCard item={item} onOpen={setSelected} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            )}
          </>
        )}
      </div>

      <aside className="sticky top-8 hidden lg:block" aria-label="Your order">
        <CartPanel />
      </aside>

      <CartBar />
      <ItemSheet item={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
