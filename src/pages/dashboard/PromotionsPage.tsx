import { filsToAedInput, type AdminBanner, type AdminCode, type AdminMenu, type AdminPromoDrink, type AdminPromotions } from '@shared/admin'
import { Pencil, Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { AedInput, ConfirmDelete, Field, ImagePicker, SelectInput, Switch, TextAreaInput, TextInput, useSaver } from '../../components/dashboard/forms'
import { LoadingLine } from '../../components/ui/Art'
import { Button } from '../../components/ui/Button'
import { StatusChip } from '../../components/ui/Chip'
import { inputClass } from '../../components/ui/Fields'
import { ErrorState } from '../../components/ui/States'
import { Sheet } from '../../components/ui/Sheet'
import { useToast } from '../../components/ui/Toast'
import { api, ApiError, errorMessage } from '../../lib/api'
import { cx } from '../../lib/cx'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

/** "2026-11-29" from an ISO time, in this device's clock. */
const toDateInput = (iso: string | null): string => {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const startOfDay = (v: string): string | null => (v ? new Date(`${v}T00:00:00`).toISOString() : null)
const endOfDay = (v: string): string | null => (v ? new Date(`${v}T23:59:59`).toISOString() : null)
const niceDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '')

function DateInput({ label, value, onChange, helper }: { label: string; value: string; onChange: (v: string) => void; helper?: string }) {
  return (
    <Field label={label} helper={helper}>
      <input type="date" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={cx(inputClass, 'border-control')} />
    </Field>
  )
}

/* ---------- Drink of the Month ---------- */

function DrinkOfMonthSection({ drink, menu, onChanged }: { drink: AdminPromoDrink | null; menu: AdminMenu; onChanged: () => void }) {
  const saver = useSaver()
  const toast = useToast()
  const items = menu.categories.flatMap((c) => c.items.filter((i) => !i.hidden).map((i) => ({ ...i, category: c.name })))
  const [itemId, setItemId] = useState<number | null>(drink?.itemId ?? null)
  const [headline, setHeadline] = useState(drink?.headline ?? '')
  const [copy, setCopy] = useState(drink?.copy ?? '')
  const [imageUrl, setImageUrl] = useState<string | null>(drink?.imageUrl ?? null)
  const [endsAt, setEndsAt] = useState(toDateInput(drink?.endsAt ?? null))
  const [active, setActive] = useState(drink?.active ?? true)

  return (
    <section aria-labelledby="dotm-admin" className="grid gap-5">
      <div>
        <h2 id="dotm-admin" className="text-headline font-semibold">Drink of the Month</h2>
        <p className="text-body-sm text-muted">The big feature at the top of the customer home screen.</p>
      </div>
      <div className="grid max-w-2xl gap-5">
        <SelectInput
          label="Item"
          value={itemId ?? ''}
          onChange={(e) => {
            const id = e.target.value ? Number(e.target.value) : null
            setItemId(id)
            const picked = items.find((i) => i.id === id)
            if (picked && !headline.trim()) setHeadline(picked.name)
          }}
        >
          <option value="">Pick an item</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>{i.name} ({i.category})</option>
          ))}
        </SelectInput>
        <TextInput label="Headline" value={headline} onChange={setHeadline} maxLength={60} />
        <TextAreaInput label="Short copy" value={copy} onChange={setCopy} maxLength={140} rows={2} helper="One line. Keep it plain." />
        <div className="grid gap-5 sm:grid-cols-2">
          <DateInput label="Last day" value={endsAt} onChange={setEndsAt} helper="It stops showing after this day. Leave empty to keep it up." />
          <div className="pt-7">
            <Switch checked={active} onChange={setActive} label="Show on the home screen" onText="Showing" offText="Not showing" />
          </div>
        </div>
        <ImagePicker label="Photo" value={imageUrl} onChange={setImageUrl} folder="promo" helper="Optional. Without one, the item's own photo or the ridge is used." />
        {saver.error && <p role="alert" className="text-body-sm text-danger">{saver.error}</p>}
        <div>
          <Button
            size="lg"
            busy={saver.busy}
            disabled={!headline.trim() || itemId == null}
            onClick={async () => {
              const ok = await saver.run(() => api('/dashboard/promo-drink', { method: 'PUT', body: { itemId, headline, copy, imageUrl, endsAt: endOfDay(endsAt), active } }).then(() => undefined))
              if (ok) {
                toast.show('Drink of the Month saved. Customers see it now.')
                onChanged()
              }
            }}
          >
            Save Drink of the Month
          </Button>
        </div>
      </div>
    </section>
  )
}

/* ---------- Banners ---------- */

function BannerEditor({ banner, menu, onClose, onChanged }: { banner: AdminBanner | null; menu: AdminMenu; onClose: () => void; onChanged: () => void }) {
  const saver = useSaver()
  const items = menu.categories.flatMap((c) => c.items.filter((i) => !i.hidden))
  const [title, setTitle] = useState(banner?.title ?? '')
  const [body, setBody] = useState(banner?.body ?? '')
  const [imageUrl, setImageUrl] = useState<string | null>(banner?.imageUrl ?? null)
  const [itemId, setItemId] = useState<number | null>(banner?.itemId ?? null)
  const [active, setActive] = useState(banner?.active ?? true)
  const [startsAt, setStartsAt] = useState(toDateInput(banner?.startsAt ?? null))
  const [endsAt, setEndsAt] = useState(toDateInput(banner?.endsAt ?? null))

  return (
    <Sheet open onClose={onClose} title={banner ? 'Edit banner' : 'New banner'}>
      <div className="grid gap-5 pb-4">
        <TextInput label="Title" value={title} onChange={setTitle} maxLength={60} />
        <TextAreaInput label="Text" value={body} onChange={setBody} maxLength={160} rows={2} />
        <SelectInput label="Points to an item" value={itemId ?? ''} onChange={(e) => setItemId(e.target.value ? Number(e.target.value) : null)} helper="Adds a button that opens the item. Optional.">
          <option value="">No item</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </SelectInput>
        <div className="grid gap-5 sm:grid-cols-2">
          <DateInput label="First day" value={startsAt} onChange={setStartsAt} />
          <DateInput label="Last day" value={endsAt} onChange={setEndsAt} />
        </div>
        <ImagePicker label="Photo" value={imageUrl} onChange={setImageUrl} folder="promo" />
        <Switch checked={active} onChange={setActive} label="Showing" onText="Showing" offText="Not showing" />
        {saver.error && <p role="alert" className="text-body-sm text-danger">{saver.error}</p>}
        <div className="flex flex-wrap gap-3">
          <Button
            size="xl"
            busy={saver.busy}
            disabled={!title.trim()}
            onClick={async () => {
              const payload = { title, body, imageUrl, itemId, active, startsAt: startOfDay(startsAt), endsAt: endOfDay(endsAt) }
              const ok = await saver.run(() => (banner ? api(`/dashboard/banners/${banner.id}`, { method: 'PUT', body: payload }) : api('/dashboard/banners', { body: payload })).then(() => undefined))
              if (ok) {
                onChanged()
                onClose()
              }
            }}
          >
            {banner ? 'Save banner' : 'Add banner'}
          </Button>
          <Button size="xl" variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
        {banner && (
          <ConfirmDelete confirmText="Delete this banner?" busy={saver.busy} onConfirm={async () => { if (await saver.run(() => api(`/dashboard/banners/${banner.id}`, { method: 'DELETE' }).then(() => undefined))) { onChanged(); onClose() } }} />
        )}
      </div>
    </Sheet>
  )
}

function BannersSection({ banners, menu, onChanged }: { banners: AdminBanner[]; menu: AdminMenu; onChanged: () => void }) {
  const [editing, setEditing] = useState<AdminBanner | 'new' | null>(null)
  return (
    <section aria-labelledby="banners-admin" className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="banners-admin" className="text-headline font-semibold">Promo banners</h2>
          <p className="text-body-sm text-muted">The home screen shows up to two active banners.</p>
        </div>
        <Button size="md" onClick={() => setEditing('new')}>
          <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
          New banner
        </Button>
      </div>
      {banners.length === 0 ? (
        <p className="rounded-lg border border-dashed border-control px-4 py-8 text-center text-body text-muted">No banners yet.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {banners.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <div className="min-w-0 flex-1 basis-60">
                <p className="text-title font-semibold leading-snug">{b.title}</p>
                <p className="text-body-sm text-muted">
                  {b.body}
                  {(b.startsAt || b.endsAt) && ` · ${niceDate(b.startsAt) || 'now'} to ${niceDate(b.endsAt) || 'no end date'}`}
                </p>
              </div>
              {b.isSample && <StatusChip tone="neutral">Sample</StatusChip>}
              <StatusChip tone={b.active ? 'success' : 'neutral'}>{b.active ? 'Showing' : 'Not showing'}</StatusChip>
              <Button size="md" variant="secondary" onClick={() => setEditing(b)} aria-label={`Edit ${b.title}`}>
                <Pencil size={16} strokeWidth={1.75} aria-hidden="true" />
                Edit
              </Button>
            </li>
          ))}
        </ul>
      )}
      {editing && <BannerEditor key={editing === 'new' ? 'new' : editing.id} banner={editing === 'new' ? null : editing} menu={menu} onClose={() => setEditing(null)} onChanged={onChanged} />}
    </section>
  )
}

/* ---------- Discount codes ---------- */

function CodeEditor({ code, onClose, onChanged }: { code: AdminCode | null; onClose: () => void; onChanged: () => void }) {
  const saver = useSaver()
  const [text, setText] = useState(code?.code ?? '')
  const [kind, setKind] = useState<'percent' | 'fixed'>(code?.kind ?? 'percent')
  const [percent, setPercent] = useState(code && code.kind === 'percent' ? String(code.value) : '10')
  const [fixed, setFixed] = useState(code && code.kind === 'fixed' ? code.value : 500)
  const [maxUses, setMaxUses] = useState(code?.maxUses != null ? String(code.maxUses) : '')
  const [startsAt, setStartsAt] = useState(toDateInput(code?.startsAt ?? null))
  const [endsAt, setEndsAt] = useState(toDateInput(code?.endsAt ?? null))
  const [active, setActive] = useState(code?.active ?? true)

  const value = kind === 'percent' ? Number(percent) : fixed
  const valid = /^[A-Za-z0-9-]{3,20}$/.test(text.trim()) && (kind === 'percent' ? Number.isInteger(value) && value >= 1 && value <= 100 : value >= 100)

  return (
    <Sheet open onClose={onClose} title={code ? `Edit ${code.code}` : 'New discount code'}>
      <div className="grid gap-5 pb-4">
        <TextInput label="Code" value={text} onChange={(v) => setText(v.toUpperCase())} maxLength={20} helper="3 to 20 letters, numbers or dashes. Customers type it at checkout." />
        <SelectInput label="Type" value={kind} onChange={(e) => setKind(e.target.value as 'percent' | 'fixed')}>
          <option value="percent">Percentage off</option>
          <option value="fixed">Fixed amount off</option>
        </SelectInput>
        {kind === 'percent' ? (
          <TextInput label="Percent off" value={percent} onChange={(v) => setPercent(v.replace(/\D/g, ''))} helper="1 to 100." />
        ) : (
          <AedInput label="Amount off" fils={fixed} onChange={setFixed} allowZero={false} />
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          <DateInput label="First day" value={startsAt} onChange={setStartsAt} />
          <DateInput label="Last day" value={endsAt} onChange={setEndsAt} />
        </div>
        <TextInput label="Most uses" value={maxUses} onChange={(v) => setMaxUses(v.replace(/\D/g, ''))} helper="Leave empty for no limit." />
        <Switch checked={active} onChange={setActive} label="Active" onText="Active" offText="Switched off" />
        {saver.error && <p role="alert" className="text-body-sm text-danger">{saver.error}</p>}
        <div className="flex flex-wrap gap-3">
          <Button
            size="xl"
            busy={saver.busy}
            disabled={!valid}
            onClick={async () => {
              const payload = { code: text, kind, value, startsAt: startOfDay(startsAt), endsAt: endOfDay(endsAt), active, maxUses: maxUses ? Number(maxUses) : null }
              const ok = await saver.run(() => (code ? api(`/dashboard/codes/${code.id}`, { method: 'PUT', body: payload }) : api('/dashboard/codes', { body: payload })).then(() => undefined))
              if (ok) {
                onChanged()
                onClose()
              }
            }}
          >
            {code ? 'Save code' : 'Add code'}
          </Button>
          <Button size="xl" variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
        {code && (
          <ConfirmDelete confirmText={`Delete ${code.code}? Orders that used it keep their discount.`} busy={saver.busy} onConfirm={async () => { if (await saver.run(() => api(`/dashboard/codes/${code.id}`, { method: 'DELETE' }).then(() => undefined))) { onChanged(); onClose() } }} />
        )}
      </div>
    </Sheet>
  )
}

function CodesSection({ codes, onChanged }: { codes: AdminCode[]; onChanged: () => void }) {
  const [editing, setEditing] = useState<AdminCode | 'new' | null>(null)
  return (
    <section aria-labelledby="codes-admin" className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="codes-admin" className="text-headline font-semibold">Discount codes</h2>
          <p className="text-body-sm text-muted">Customers type a code at checkout. The discount comes off before any reward points.</p>
        </div>
        <Button size="md" onClick={() => setEditing('new')}>
          <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
          New code
        </Button>
      </div>
      {codes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-control px-4 py-8 text-center text-body text-muted">No codes yet.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {codes.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <div className="min-w-0 flex-1 basis-56">
                <p className="font-display text-headline font-semibold leading-none tracking-wide">{c.code}</p>
                <p className="mt-1 text-body-sm text-muted tnum">
                  {c.kind === 'percent' ? `${c.value}% off` : `AED ${filsToAedInput(c.value)} off`} · used {c.uses}
                  {c.maxUses != null ? ` of ${c.maxUses}` : ''} times
                  {(c.startsAt || c.endsAt) && ` · ${niceDate(c.startsAt) || 'now'} to ${niceDate(c.endsAt) || 'no end date'}`}
                </p>
              </div>
              {c.isSample && <StatusChip tone="neutral">Sample</StatusChip>}
              <StatusChip tone={c.active ? 'success' : 'neutral'}>{c.active ? 'Active' : 'Switched off'}</StatusChip>
              <Button size="md" variant="secondary" onClick={() => setEditing(c)} aria-label={`Edit ${c.code}`}>
                <Pencil size={16} strokeWidth={1.75} aria-hidden="true" />
                Edit
              </Button>
            </li>
          ))}
        </ul>
      )}
      {editing && <CodeEditor key={editing === 'new' ? 'new' : editing.id} code={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onChanged={onChanged} />}
    </section>
  )
}

export function PromotionsPage() {
  useDocumentTitle('Promotions')
  const [promos, setPromos] = useState<AdminPromotions | null>(null)
  const [menu, setMenu] = useState<AdminMenu | null>(null)
  const [error, setError] = useState<{ message: string; offline: boolean } | null>(null)

  const load = useCallback(async () => {
    try {
      const [p, m] = await Promise.all([api<AdminPromotions>('/dashboard/promotions'), api<AdminMenu>('/dashboard/menu')])
      setPromos(p)
      setMenu(m)
      setError(null)
    } catch (e) {
      setError({ message: errorMessage(e), offline: e instanceof ApiError && e.isOffline })
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  if (!promos || !menu) {
    return error ? (
      <ErrorState title="Promotions didn't load" message={error.message} offline={error.offline} onRetry={() => void load()} className="max-w-xl" />
    ) : (
      <div role="status" className="max-w-md pt-4">
        <LoadingLine label="Loading promotions" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-display-lg font-bold">Promotions</h1>
      <div className="mt-8 grid gap-14">
        <DrinkOfMonthSection key={`${promos.drink?.headline}-${promos.drink?.itemId}-${promos.drink?.endsAt}`} drink={promos.drink} menu={menu} onChanged={() => void load()} />
        <BannersSection banners={promos.banners} menu={menu} onChanged={() => void load()} />
        <CodesSection codes={promos.codes} onChanged={() => void load()} />
      </div>
    </div>
  )
}
