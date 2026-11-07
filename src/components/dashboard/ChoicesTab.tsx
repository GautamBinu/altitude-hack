import { filsToAedInput, parseAedToFils, type AdminGroup, type AdminMenu } from '@shared/admin'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../lib/api'
import { cx } from '../../lib/cx'
import { Button } from '../ui/Button'
import { inputClass } from '../ui/Fields'
import { ConfirmDelete, Switch, TextInput, useSaver } from './forms'

interface DraftOption {
  id?: number
  name: string
  price: string
  isDefault: boolean
  unconfirmed: boolean
}

interface Draft {
  name: string
  kind: 'single' | 'multi'
  required: boolean
  showDefault: boolean
  inlineLabel: boolean
  options: DraftOption[]
}

const toDraft = (g: AdminGroup): Draft => ({
  name: g.name,
  kind: g.kind,
  required: g.required,
  showDefault: g.showDefault,
  inlineLabel: g.inlineLabel,
  options: g.options.map((o) => ({ id: o.id, name: o.name, price: filsToAedInput(o.priceDeltaFils), isDefault: o.isDefault, unconfirmed: o.unconfirmed })),
})

const blank = (): Draft => ({
  name: '',
  kind: 'single',
  required: true,
  showDefault: true,
  inlineLabel: false,
  options: [{ name: '', price: '0', isDefault: true, unconfirmed: false }],
})

function GroupEditor({ group, onChanged, onCancel }: { group: AdminGroup | null; onChanged: () => void; onCancel?: () => void }) {
  const saver = useSaver()
  const [draft, setDraft] = useState<Draft>(group ? toDraft(group) : blank())
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  const setOption = (index: number, patch: Partial<DraftOption>) =>
    setDraft((d) => ({ ...d, options: d.options.map((o, i) => (i === index ? { ...o, ...patch } : patch.isDefault && d.kind === 'single' ? { ...o, isDefault: false } : o)) }))

  const save = async () => {
    const options = draft.options.map((o) => ({
      id: o.id,
      name: o.name,
      priceDeltaFils: parseAedToFils(o.price) ?? NaN,
      isDefault: o.isDefault,
      unconfirmed: o.unconfirmed,
    }))
    if (options.some((o) => Number.isNaN(o.priceDeltaFils))) {
      saver.setError('Every add-on price needs to be a number such as 0, 6 or 1.50.')
      return
    }
    const ok = await saver.run(async () => {
      const body = { ...draft, options }
      if (group) await api(`/dashboard/groups/${group.id}`, { method: 'PUT', body })
      else await api('/dashboard/groups', { method: 'POST', body })
    })
    if (ok) {
      onChanged()
      onCancel?.()
    }
  }

  return (
    <div className="grid gap-5 rounded-lg border border-line bg-surface p-4 md:p-5">
      <TextInput label="Name of the choice" value={draft.name} onChange={(name) => set({ name })} maxLength={40} helper="For example Milk, Syrup or Size." />
      <div className="flex flex-wrap gap-x-8 gap-y-1">
        <Switch checked={draft.kind === 'multi'} onChange={(v) => set({ kind: v ? 'multi' : 'single', required: v ? false : draft.required })} label="Customer can pick several" onText="Pick several" offText="Pick one" />
        <Switch checked={draft.required} onChange={(required) => set({ required })} label="Customer must choose" onText="Must choose" offText="Optional" disabled={draft.kind === 'multi'} />
        <Switch checked={draft.showDefault} onChange={(showDefault) => set({ showDefault })} label="Show the default on the order" onText="Default shown on tickets" offText="Default left off tickets" />
      </div>

      <div>
        <p className="mb-2 text-body-sm font-semibold">Options</p>
        <ul className="grid gap-2">
          {draft.options.map((option, index) => (
            <li key={option.id ?? `new-${index}`} className="grid grid-cols-[minmax(0,1fr)_7rem_auto_auto] items-center gap-2">
              <input
                aria-label={`Option ${index + 1} name`}
                value={option.name}
                maxLength={40}
                onChange={(e) => setOption(index, { name: e.target.value })}
                className={cx(inputClass, 'border-control')}
                placeholder="Option name"
              />
              <div className="relative">
                <input
                  aria-label={`${option.name || `Option ${index + 1}`} add-on price`}
                  value={option.price}
                  inputMode="decimal"
                  onChange={(e) => setOption(index, { price: e.target.value, unconfirmed: false })}
                  className={cx(inputClass, 'border-control pr-12 tnum')}
                />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-label font-semibold uppercase text-muted">AED</span>
              </div>
              {draft.kind === 'single' ? (
                <label className="inline-flex min-h-11 items-center gap-2 px-1 text-body-sm font-semibold">
                  <input type="radio" name={`default-${group?.id ?? 'new'}`} checked={option.isDefault} onChange={() => setOption(index, { isDefault: true })} className="size-4" />
                  Default
                </label>
              ) : (
                <span />
              )}
              <button
                type="button"
                aria-label={`Remove ${option.name || `option ${index + 1}`}`}
                disabled={draft.options.length <= 1}
                onClick={() => set({ options: draft.options.filter((_, i) => i !== index) })}
                className="grid size-11 place-items-center rounded-md text-muted transition-colors hover:bg-raised hover:text-danger disabled:opacity-40"
              >
                <Trash2 size={18} strokeWidth={1.75} aria-hidden="true" />
              </button>
              {option.unconfirmed && <p className="col-span-full -mt-1 text-body-sm text-warning">Placeholder price, not confirmed. Change it to confirm.</p>}
            </li>
          ))}
        </ul>
        <Button variant="secondary" size="md" className="mt-3" onClick={() => set({ options: [...draft.options, { name: '', price: '0', isDefault: false, unconfirmed: false }] })}>
          <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
          Add an option
        </Button>
      </div>

      {saver.error && (
        <p role="alert" className="text-body-sm text-danger">
          {saver.error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" busy={saver.busy} onClick={() => void save()} disabled={draft.name.trim().length === 0}>
          {group ? 'Save choice' : 'Add choice'}
        </Button>
        {onCancel && (
          <Button variant="secondary" size="lg" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
      {group && group.key !== 'temperature' && (
        <ConfirmDelete
          label="Delete choice"
          confirmText={group.usedBy > 0 ? `${group.usedBy} items use this choice. Remove it from them first.` : `Delete the ${group.name} choice?`}
          busy={saver.busy}
          onConfirm={async () => {
            const ok = await saver.run(() => api(`/dashboard/groups/${group.id}`, { method: 'DELETE' }).then(() => undefined))
            if (ok) onChanged()
          }}
        />
      )}
    </div>
  )
}

/** Milk alternatives, temperature, acai bases and toppings: the choices items offer. Changing a price here changes it everywhere. */
export function ChoicesTab({ menu, onChanged }: { menu: AdminMenu; onChanged: () => void }) {
  const [openId, setOpenId] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  return (
    <div className="grid gap-3">
      <p className="max-w-2xl text-body text-muted">
        These are the choices customers see on an item, such as milk or toppings. Change an add-on price here and it changes on every item that offers it.
      </p>
      <ul className="grid gap-3">
        {menu.groups.map((group) => (
          <li key={group.id}>
            {openId === group.id ? (
              <GroupEditor group={group} onChanged={onChanged} onCancel={() => setOpenId(null)} />
            ) : (
              <button
                type="button"
                onClick={() => setOpenId(group.id)}
                className="flex min-h-16 w-full items-center justify-between gap-4 rounded-lg border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-control"
              >
                <span className="min-w-0">
                  <span className="block text-title font-semibold">{group.name}</span>
                  <span className="block truncate text-body-sm text-muted">
                    {group.options.map((o) => o.name).join(', ')} · used by {group.usedBy} {group.usedBy === 1 ? 'item' : 'items'}
                  </span>
                </span>
                <span className="shrink-0 text-body-sm font-semibold text-ink">Edit</span>
              </button>
            )}
          </li>
        ))}
      </ul>
      {adding ? (
        <GroupEditor group={null} onChanged={() => { onChanged(); setAdding(false) }} onCancel={() => setAdding(false)} />
      ) : (
        <div>
          <Button variant="secondary" size="lg" onClick={() => setAdding(true)}>
            <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
            New choice
          </Button>
        </div>
      )}
    </div>
  )
}
