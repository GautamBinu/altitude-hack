import type { AdminCategory, AdminItem, AdminMenu } from '@shared/admin'
import { ArrowDown, ArrowUp, Pencil, Plus, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BuilderTab, SummitTab } from '../../components/dashboard/BuilderTab'
import { ChoicesTab } from '../../components/dashboard/ChoicesTab'
import { ConfirmDelete, Switch, Tabs, TextInput, useSaver } from '../../components/dashboard/forms'
import { ItemEditor } from '../../components/dashboard/ItemEditor'
import { Mountains, LoadingLine } from '../../components/ui/Art'
import { Button } from '../../components/ui/Button'
import { StatusChip } from '../../components/ui/Chip'
import { inputClass } from '../../components/ui/Fields'
import { Price } from '../../components/ui/Price'
import { ErrorState } from '../../components/ui/States'
import { useToast } from '../../components/ui/Toast'
import { api, ApiError, errorMessage } from '../../lib/api'
import { cx } from '../../lib/cx'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { useStaff } from '../../state/staff'

type TabKey = 'items' | 'choices' | 'builder' | 'summit'

function Thumb({ item }: { item: AdminItem }) {
  return (
    <span className="relative block size-12 shrink-0 overflow-hidden rounded-md border border-line bg-raised" aria-hidden="true">
      {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" /> : <Mountains />}
    </span>
  )
}

function CategoryPanel({ category, isFirst, isLast, onChanged }: { category: AdminCategory; isFirst: boolean; isLast: boolean; onChanged: () => void }) {
  const saver = useSaver()
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(category.name)
  return (
    <div className="grid gap-3 rounded-lg border border-line bg-surface p-3">
      {renaming ? (
        <>
          <TextInput label="Category name" value={name} onChange={setName} maxLength={40} />
          <div className="flex gap-2">
            <Button size="md" busy={saver.busy} onClick={async () => { if (await saver.run(() => api(`/dashboard/categories/${category.id}`, { method: 'PATCH', body: { name } }).then(() => undefined))) { setRenaming(false); onChanged() } }}>
              Save
            </Button>
            <Button size="md" variant="secondary" onClick={() => { setRenaming(false); setName(category.name) }}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="md" variant="secondary" onClick={() => setRenaming(true)}>
            <Pencil size={16} strokeWidth={1.75} aria-hidden="true" />
            Rename
          </Button>
          <Button size="md" variant="secondary" disabled={isFirst} aria-label={`Move ${category.name} up`} onClick={async () => { await saver.run(() => api(`/dashboard/categories/${category.id}/move`, { body: { direction: 'up' } }).then(() => undefined)); onChanged() }}>
            <ArrowUp size={16} strokeWidth={1.75} aria-hidden="true" />
          </Button>
          <Button size="md" variant="secondary" disabled={isLast} aria-label={`Move ${category.name} down`} onClick={async () => { await saver.run(() => api(`/dashboard/categories/${category.id}/move`, { body: { direction: 'down' } }).then(() => undefined)); onChanged() }}>
            <ArrowDown size={16} strokeWidth={1.75} aria-hidden="true" />
          </Button>
        </div>
      )}
      {saver.error && <p role="alert" className="text-body-sm text-danger">{saver.error}</p>}
      <ConfirmDelete
        label="Delete category"
        confirmText={`Delete ${category.name} and its ${category.items.length} ${category.items.length === 1 ? 'item' : 'items'}? Orders already placed keep their record.`}
        busy={saver.busy}
        onConfirm={async () => { if (await saver.run(() => api(`/dashboard/categories/${category.id}`, { method: 'DELETE' }).then(() => undefined))) onChanged() }}
      />
    </div>
  )
}

export function MenuManagerPage() {
  useDocumentTitle('Menu')
  const { user } = useStaff()
  const isAdmin = user?.role === 'admin'
  const toast = useToast()
  const [menu, setMenu] = useState<AdminMenu | null>(null)
  const [error, setError] = useState<{ message: string; offline: boolean } | null>(null)
  const [tab, setTab] = useState<TabKey>('items')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [onlyUnconfirmed, setOnlyUnconfirmed] = useState(false)
  const [editing, setEditing] = useState<AdminItem | 'new' | null>(null)
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [managing, setManaging] = useState(false)
  const saver = useSaver()

  const load = useCallback(async () => {
    try {
      const data = await api<AdminMenu>('/dashboard/menu')
      setMenu(data)
      setError(null)
      setCategoryId((current) => (current != null && data.categories.some((c) => c.id === current) ? current : (data.categories[0]?.id ?? null)))
    } catch (e) {
      setError({ message: errorMessage(e), offline: e instanceof ApiError && e.isOffline })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const unconfirmedCount = useMemo(() => menu?.categories.reduce((n, c) => n + c.items.filter((i) => i.priceUnconfirmed).length, 0) ?? 0, [menu])

  if (!menu) {
    return error ? (
      <ErrorState title="The menu didn't load" message={error.message} offline={error.offline} onRetry={() => void load()} className="max-w-xl" />
    ) : (
      <div role="status" className="max-w-md pt-4">
        <LoadingLine label="Loading the menu" />
      </div>
    )
  }

  const searching = query.trim().length > 0 || onlyUnconfirmed
  const category = menu.categories.find((c) => c.id === categoryId) ?? menu.categories[0]
  const visible: { item: AdminItem; categoryName: string }[] = searching
    ? menu.categories.flatMap((c) =>
        c.items
          .filter((i) => (!onlyUnconfirmed || i.priceUnconfirmed) && (!query.trim() || `${i.name} ${i.description}`.toLowerCase().includes(query.trim().toLowerCase())))
          .map((item) => ({ item, categoryName: c.name })),
      )
    : (category?.items ?? []).map((item) => ({ item, categoryName: category!.name }))

  const toggleSoldOut = async (item: AdminItem, soldOut: boolean) => {
    try {
      await api(`/dashboard/items/${item.id}/availability`, { body: { soldOut } })
      toast.show(soldOut ? `${item.name} is marked sold out.` : `${item.name} is back on.`)
      await load()
    } catch (e) {
      toast.show(errorMessage(e), 'error')
    }
  }

  const move = async (item: AdminItem, direction: 'up' | 'down') => {
    await saver.run(() => api(`/dashboard/items/${item.id}/move`, { body: { direction } }).then(() => undefined))
    await load()
  }

  const tabs: { key: TabKey; label: string }[] = isAdmin
    ? [
        { key: 'items', label: 'Items' },
        { key: 'choices', label: 'Choices and add-ons' },
        { key: 'builder', label: 'Builder' },
        { key: 'summit', label: 'Summit Box' },
      ]
    : [{ key: 'items', label: 'Items' }]

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-display-lg font-bold">Menu</h1>
        {!isAdmin && <p className="text-body-sm text-muted">You can mark items sold out. An admin changes names and prices.</p>}
      </div>

      <div className="mt-4">
        <Tabs tabs={tabs} value={tab} onChange={setTab} label="Menu sections" />
      </div>

      <div className="mt-6">
        {tab === 'items' && (
          <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
            <aside aria-label="Categories" className="grid gap-3">
              <div className="flex gap-2 overflow-x-auto lg:grid lg:overflow-visible" role="tablist" aria-label="Categories" aria-orientation="vertical">
                {menu.categories.map((c) => {
                  const on = !searching && category?.id === c.id
                  return (
                    <button
                      key={c.id}
                      role="tab"
                      type="button"
                      aria-selected={on}
                      onClick={() => { setCategoryId(c.id); setQuery(''); setOnlyUnconfirmed(false); setManaging(false) }}
                      className={cx(
                        'flex min-h-11 shrink-0 items-center justify-between gap-3 rounded-md px-3 text-left text-body font-semibold transition-colors',
                        on ? 'bg-raised text-ink shadow-[inset_2px_0_0_var(--c-accent)]' : 'text-muted hover:bg-surface hover:text-ink',
                      )}
                    >
                      <span className="truncate">{c.name}</span>
                      <span className="text-body-sm font-normal tnum">{c.items.length}</span>
                    </button>
                  )
                })}
              </div>
              {isAdmin && (
                <>
                  {addingCategory ? (
                    <div className="grid gap-2">
                      <TextInput label="New category" value={newCategory} onChange={setNewCategory} maxLength={40} />
                      <div className="flex gap-2">
                        <Button size="md" busy={saver.busy} disabled={!newCategory.trim()} onClick={async () => { if (await saver.run(() => api('/dashboard/categories', { body: { name: newCategory } }).then(() => undefined))) { setNewCategory(''); setAddingCategory(false); await load() } }}>
                          Add
                        </Button>
                        <Button size="md" variant="secondary" onClick={() => setAddingCategory(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="md" variant="secondary" onClick={() => setAddingCategory(true)}>
                      <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
                      Add category
                    </Button>
                  )}
                  {category && !searching && (
                    <>
                      <Button size="md" variant="tertiary" onClick={() => setManaging((m) => !m)} aria-expanded={managing}>
                        {managing ? 'Hide category options' : `Manage ${category.name}`}
                      </Button>
                      {managing && (
                        <CategoryPanel
                          category={category}
                          isFirst={menu.categories[0]?.id === category.id}
                          isLast={menu.categories[menu.categories.length - 1]?.id === category.id}
                          onChanged={() => void load()}
                        />
                      )}
                    </>
                  )}
                  {saver.error && <p role="alert" className="text-body-sm text-danger">{saver.error}</p>}
                </>
              )}
            </aside>

            <section aria-label="Items" className="min-w-0">
              <div className="flex flex-wrap items-end gap-3">
                <div className="relative min-w-56 flex-1">
                  <label htmlFor="item-search" className="sr-only">Search all items</label>
                  <Search size={18} strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" aria-hidden="true" />
                  <input id="item-search" type="search" placeholder="Search all items" value={query} onChange={(e) => setQuery(e.target.value)} className={cx(inputClass, 'border-control pl-10')} />
                </div>
                <button
                  type="button"
                  aria-pressed={onlyUnconfirmed}
                  onClick={() => setOnlyUnconfirmed((v) => !v)}
                  className={cx('min-h-12 rounded-md border px-4 text-body-sm font-semibold transition-colors', onlyUnconfirmed ? 'border-accent bg-raised shadow-[inset_0_0_0_1px_var(--c-accent)]' : 'border-control hover:bg-raised')}
                >
                  Unconfirmed prices <span className="tnum text-muted">({unconfirmedCount})</span>
                </button>
                {isAdmin && category && (
                  <Button size="lg" onClick={() => setEditing('new')}>
                    <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
                    Add item
                  </Button>
                )}
              </div>

              {visible.length === 0 ? (
                <p className="mt-6 rounded-lg border border-dashed border-control px-4 py-10 text-center text-body text-muted">
                  {searching ? 'No items match.' : 'This category has no items yet.'}
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-line border-y border-line xl:columns-2 xl:gap-x-10">
                  {visible.map(({ item, categoryName }, index) => (
                    <li key={item.id} className="flex break-inside-avoid flex-wrap items-center gap-x-4 gap-y-2 py-3">
                      <Thumb item={item} />
                      <div className="min-w-0 flex-1 basis-48">
                        <p className="truncate text-title font-semibold leading-snug">{item.name}</p>
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-muted">
                          {searching && <span>{categoryName}</span>}
                          <span className="tnum">{Math.round(item.prepSeconds / 60 * 10) / 10} min prep</span>
                          {item.priceUnconfirmed && <StatusChip tone="warning">Unconfirmed price</StatusChip>}
                          {item.hidden && <StatusChip tone="neutral">Hidden</StatusChip>}
                        </p>
                      </div>
                      <Price fils={item.priceFils} size="md" />
                      <Switch checked={item.soldOut} onChange={(v) => void toggleSoldOut(item, v)} label={`${item.name} sold out`} onText="Sold out" offText="Available" />
                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          {!searching && (
                            <>
                              <button type="button" aria-label={`Move ${item.name} up`} disabled={index === 0} onClick={() => void move(item, 'up')} className="grid size-11 place-items-center rounded-md text-muted hover:bg-raised hover:text-ink disabled:opacity-30">
                                <ArrowUp size={18} strokeWidth={1.75} aria-hidden="true" />
                              </button>
                              <button type="button" aria-label={`Move ${item.name} down`} disabled={index === visible.length - 1} onClick={() => void move(item, 'down')} className="grid size-11 place-items-center rounded-md text-muted hover:bg-raised hover:text-ink disabled:opacity-30">
                                <ArrowDown size={18} strokeWidth={1.75} aria-hidden="true" />
                              </button>
                            </>
                          )}
                          <Button size="md" variant="secondary" onClick={() => setEditing(item)} aria-label={`Edit ${item.name}`}>
                            <Pencil size={16} strokeWidth={1.75} aria-hidden="true" />
                            Edit
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        {tab === 'choices' && isAdmin && <ChoicesTab menu={menu} onChanged={() => void load()} />}
        {tab === 'builder' && isAdmin && <BuilderTab menu={menu} onChanged={() => void load()} />}
        {tab === 'summit' && isAdmin && <SummitTab prices={menu.summitBox} onChanged={() => void load()} />}
      </div>

      {editing && category && (
        <ItemEditor
          key={editing === 'new' ? 'new' : editing.id}
          menu={menu}
          item={editing === 'new' ? null : editing}
          defaultCategoryId={category.id}
          onClose={() => setEditing(null)}
          onChanged={() => void load()}
        />
      )}
    </div>
  )
}
