import { filsToAedInput, parseAedToFils, type AdminBuilderOption, type AdminMenu, type SummitBoxPrice } from '@shared/admin'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../lib/api'
import { cx } from '../../lib/cx'
import { Button } from '../ui/Button'
import { inputClass } from '../ui/Fields'
import { ConfirmDelete, NumberInput, Switch, useSaver } from './forms'

const KINDS: { kind: AdminBuilderOption['kind']; title: string; priceLabel: string; help: string }[] = [
  { kind: 'base', title: 'Bases', priceLabel: 'Starting price', help: 'The drink the customer starts from. Its price is where the total begins.' },
  { kind: 'flavour', title: 'Flavours', priceLabel: 'Add-on', help: 'Spanish, rose, saffron and the rest. Priced as an add-on to the base.' },
  { kind: 'shot', title: 'Extra shot', priceLabel: 'Add-on', help: 'The price of each extra shot. Customers can add up to two.' },
  { kind: 'sweetness', title: 'Sweetness', priceLabel: 'Add-on', help: 'How sweet. Usually free.' },
  { kind: 'topping', title: 'Toppings', priceLabel: 'Add-on', help: 'A finishing touch on top.' },
]

function Row({ option, onChanged }: { option: AdminBuilderOption; onChanged: () => void }) {
  const saver = useSaver()
  const [name, setName] = useState(option.name)
  const [price, setPrice] = useState(filsToAedInput(option.priceFils))
  const [available, setAvailable] = useState(option.available)
  const [temperature, setTemperature] = useState(option.temperature)
  const [usesMilk, setUsesMilk] = useState(option.usesMilk)
  const [prep, setPrep] = useState(option.prepSeconds)
  const [color, setColor] = useState(option.color ?? '')

  const parsed = parseAedToFils(price)
  const dirty =
    name !== option.name || parsed !== option.priceFils || available !== option.available || temperature !== option.temperature ||
    usesMilk !== option.usesMilk || prep !== option.prepSeconds || color !== (option.color ?? '')

  return (
    <li className="grid gap-3 rounded-lg border border-line bg-surface p-3 md:p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
        <input aria-label="Name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} className={cx(inputClass, 'border-control')} />
        <div className="relative">
          <input aria-label={`${option.name} price`} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className={cx(inputClass, 'pr-12 tnum', parsed == null ? 'border-danger' : 'border-control')} />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-label font-semibold uppercase text-muted">AED</span>
        </div>
      </div>
      {option.kind === 'base' && (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-body-sm font-semibold">
            Served
            <select value={temperature} onChange={(e) => setTemperature(e.target.value as AdminBuilderOption['temperature'])} className={cx(inputClass, 'mt-1.5 border-control')}>
              <option value="both">Hot or iced</option>
              <option value="hot">Hot only</option>
              <option value="iced">Iced only</option>
            </select>
          </label>
          <NumberInput label="Prep time" value={prep} onChange={setPrep} min={0} max={900} suffix="sec" />
          <div className="pt-6">
            <Switch checked={usesMilk} onChange={setUsesMilk} label="Takes milk" onText="Takes milk" offText="No milk" />
          </div>
        </div>
      )}
      {(option.kind === 'base' || option.kind === 'flavour' || option.kind === 'topping') && (
        <label className="flex items-center gap-3 text-body-sm font-semibold">
          Colour in the cup illustration
          <input type="text" value={color} placeholder="#a9825d" maxLength={7} onChange={(e) => setColor(e.target.value)} className={cx(inputClass, 'w-32 border-control')} />
          <span aria-hidden="true" className="size-6 rounded-sm border border-control" style={{ background: /^#[0-9a-fA-F]{6}$/.test(color) ? color : 'transparent' }} />
        </label>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Switch checked={available} onChange={setAvailable} label={`${option.name} available`} onText="Available" offText="Not available" />
        <div className="flex flex-wrap items-center gap-2">
          {option.unconfirmed && <span className="text-body-sm text-warning">Placeholder price</span>}
          {dirty && (
            <Button
              size="md"
              busy={saver.busy}
              disabled={parsed == null || name.trim().length === 0}
              onClick={async () => {
                const ok = await saver.run(() =>
                  api(`/dashboard/builder/${option.id}`, { method: 'PATCH', body: { name, priceFils: parsed, available, temperature, usesMilk, prepSeconds: prep, color: color || null } }).then(() => undefined),
                )
                if (ok) onChanged()
              }}
            >
              Save
            </Button>
          )}
        </div>
      </div>
      {saver.error && <p role="alert" className="text-body-sm text-danger">{saver.error}</p>}
      <ConfirmDelete label="Remove" confirmText={`Remove ${option.name} from the builder?`} busy={saver.busy} onConfirm={async () => { if (await saver.run(() => api(`/dashboard/builder/${option.id}`, { method: 'DELETE' }).then(() => undefined))) onChanged() }} />
    </li>
  )
}

function AddRow({ kind, onChanged }: { kind: AdminBuilderOption['kind']; onChanged: () => void }) {
  const saver = useSaver()
  const [name, setName] = useState('')
  const [price, setPrice] = useState('0')
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-body-sm font-semibold">
        New {kind === 'shot' ? 'shot option' : kind}
        <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} className={cx(inputClass, 'mt-1.5 w-56 border-control')} />
      </label>
      <label className="text-body-sm font-semibold">
        Price
        <input value={price} inputMode="decimal" onChange={(e) => setPrice(e.target.value)} className={cx(inputClass, 'mt-1.5 w-28 border-control tnum')} />
      </label>
      <Button
        variant="secondary"
        size="lg"
        busy={saver.busy}
        disabled={!name.trim() || parseAedToFils(price) == null}
        onClick={async () => {
          const ok = await saver.run(() => api('/dashboard/builder', { body: { kind, name, priceFils: parseAedToFils(price), temperature: 'both', unconfirmed: true } }).then(() => undefined))
          if (ok) {
            setName('')
            setPrice('0')
            onChanged()
          }
        }}
      >
        <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
        Add
      </Button>
      {saver.error && <p role="alert" className="w-full text-body-sm text-danger">{saver.error}</p>}
    </div>
  )
}

export function BuilderTab({ menu, onChanged }: { menu: AdminMenu; onChanged: () => void }) {
  return (
    <div className="grid gap-10">
      <p className="max-w-2xl text-body text-muted">
        These are the options in "Create your own coffee". The milk choices come from the Choices tab, so milk alternatives are priced in one place.
      </p>
      {KINDS.map(({ kind, title, priceLabel, help }) => {
        const options = menu.builder.filter((b) => b.kind === kind)
        return (
          <section key={kind} aria-labelledby={`builder-${kind}`}>
            <h2 id={`builder-${kind}`} className="text-headline font-semibold">{title}</h2>
            <p className="mb-3 text-body-sm text-muted">{help} Price column: {priceLabel.toLowerCase()}.</p>
            <ul className="grid gap-3 lg:grid-cols-2">
              {options.map((option) => (
                <Row key={`${option.id}-${option.name}-${option.priceFils}`} option={option} onChanged={onChanged} />
              ))}
            </ul>
            <div className="mt-4">
              <AddRow kind={kind} onChanged={onChanged} />
            </div>
          </section>
        )
      })}
    </div>
  )
}

export function SummitTab({ prices, onChanged }: { prices: SummitBoxPrice[]; onChanged: () => void }) {
  const saver = useSaver()
  const [rows, setRows] = useState(prices.map((p) => ({ size: String(p.size), price: filsToAedInput(p.priceFils) })))
  const parsed = rows.map((r) => ({ size: Number(r.size), priceFils: parseAedToFils(r.price) }))
  const valid = parsed.every((p) => Number.isInteger(p.size) && p.size >= 2 && p.priceFils != null) && rows.length > 0

  return (
    <div className="grid max-w-xl gap-5">
      <p className="text-body text-muted">
        A Summit Box is a prepaid bundle of drinks. Customers buy one from their profile, and use the drinks at checkout. The sizes and prices come from the menu photo.
      </p>
      <ul className="grid gap-3">
        {rows.map((row, i) => (
          <li key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
            <label className="text-body-sm font-semibold">
              Drinks in the box
              <input value={row.size} inputMode="numeric" onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, size: e.target.value.replace(/\D/g, '') } : r)))} className={cx(inputClass, 'mt-1.5 border-control tnum')} />
            </label>
            <label className="text-body-sm font-semibold">
              Price
              <div className="relative">
                <input value={row.price} inputMode="decimal" onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, price: e.target.value } : r)))} className={cx(inputClass, 'mt-1.5 border-control pr-12 tnum')} />
                <span className="pointer-events-none absolute top-1/2 right-3 mt-0.5 -translate-y-1/2 text-label font-semibold uppercase text-muted">AED</span>
              </div>
            </label>
            <Button variant="tertiary" size="md" disabled={rows.length <= 1} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
      {rows.length < 4 && (
        <div>
          <Button variant="secondary" size="md" onClick={() => setRows([...rows, { size: '', price: '' }])}>
            <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
            Add a size
          </Button>
        </div>
      )}
      {saver.error && <p role="alert" className="text-body-sm text-danger">{saver.error}</p>}
      <div>
        <Button
          size="lg"
          busy={saver.busy}
          disabled={!valid}
          onClick={async () => {
            if (await saver.run(() => api('/dashboard/summit-box', { method: 'PUT', body: { prices: parsed } }).then(() => undefined))) onChanged()
          }}
        >
          Save prices
        </Button>
      </div>
    </div>
  )
}
