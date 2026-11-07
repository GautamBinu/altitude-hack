import type { AdminItem, AdminMenu } from '@shared/admin'
import type { Temperature } from '@shared/types'
import { useState } from 'react'
import { api } from '../../lib/api'
import { Button } from '../ui/Button'
import { ChoiceGroup } from '../ui/Fields'
import { Sheet } from '../ui/Sheet'
import { AedInput, ConfirmDelete, ImagePicker, NumberInput, SelectInput, Switch, TextAreaInput, TextInput, useSaver } from './forms'

interface Props {
  menu: AdminMenu
  /** The item being edited, or null to add a new one. */
  item: AdminItem | null
  defaultCategoryId: number
  onClose: () => void
  onChanged: () => void
}

const TEMPERATURES: { value: Temperature; label: string }[] = [
  { value: 'both', label: 'Hot or iced (the customer chooses)' },
  { value: 'hot', label: 'Hot only' },
  { value: 'iced', label: 'Iced or cold only' },
  { value: 'none', label: 'Not applicable (food)' },
]

function durationText(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m === 0 ? `${s} sec` : s === 0 ? `${m} min` : `${m} min ${s} sec`
}

/** Everything about one menu item, in a side panel. Changes reach customers as soon as it is saved. */
export function ItemEditor({ menu, item, defaultCategoryId, onClose, onChanged }: Props) {
  const saver = useSaver()
  const [name, setName] = useState(item?.name ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [priceFils, setPriceFils] = useState(item?.priceFils ?? 2500)
  const [confirmed, setConfirmed] = useState(item ? !item.priceUnconfirmed : true)
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? defaultCategoryId)
  const [temperature, setTemperature] = useState<Temperature>(item?.temperature ?? 'both')
  const [caffeineFree, setCaffeineFree] = useState(item?.caffeineFree ?? false)
  const [kind, setKind] = useState<'drink' | 'food'>(item?.kind ?? 'drink')
  const [prepSeconds, setPrepSeconds] = useState(item?.prepSeconds ?? 120)
  const [tags, setTags] = useState((item?.tags ?? []).join(', '))
  const [image, setImage] = useState<string | null>(item?.imageUrl ?? null)
  const [hidden, setHidden] = useState(item?.hidden ?? false)
  const [soldOut, setSoldOut] = useState(item?.soldOut ?? false)
  const temperatureGroupId = menu.groups.find((g) => g.key === 'temperature')?.id
  const [groupIds, setGroupIds] = useState<number[]>((item?.groupIds ?? []).filter((g) => g !== temperatureGroupId))

  const choices = menu.groups.filter((g) => g.key !== 'temperature')

  const save = async () => {
    const ok = await saver.run(async () => {
      const body = {
        categoryId,
        name,
        description,
        priceFils,
        priceUnconfirmed: !confirmed,
        temperature,
        caffeineFree,
        prepSeconds,
        kind,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        image,
        soldOut,
        hidden,
        groupIds,
      }
      if (item) await api(`/dashboard/items/${item.id}`, { method: 'PATCH', body })
      else await api('/dashboard/items', { method: 'POST', body })
    })
    if (ok) {
      onChanged()
      onClose()
    }
  }

  return (
    <Sheet open onClose={onClose} title={item ? `Edit ${item.name}` : 'Add an item'}>
      <div className="grid gap-5 pb-4">
        <TextInput label="Name" value={name} onChange={setName} maxLength={80} />
        <TextAreaInput label="Description" value={description} onChange={setDescription} maxLength={240} helper="One short line shown on the menu card." />

        <div className="grid grid-cols-2 gap-4">
          <AedInput label="Price" fils={priceFils} onChange={setPriceFils} />
          <NumberInput label="Prep time" value={prepSeconds} onChange={setPrepSeconds} min={5} max={3600} suffix="sec" helper={durationText(prepSeconds)} />
        </div>
        {item?.priceUnconfirmed && (
          <div className="rounded-md border border-warning p-3">
            <p className="text-body-sm text-ink">This price is a placeholder. It was not on the menu photo.</p>
            <div className="mt-1">
              <Switch checked={confirmed} onChange={setConfirmed} label="Price is confirmed" onText="Price confirmed" offText="Price not confirmed" />
            </div>
          </div>
        )}

        <SelectInput label="Category" value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
          {menu.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectInput>

        <div className="grid grid-cols-2 gap-4">
          <SelectInput label="Kind" value={kind} onChange={(e) => setKind(e.target.value as 'drink' | 'food')} helper="Only drinks can be paid for with a Summit Box.">
            <option value="drink">Drink</option>
            <option value="food">Food</option>
          </SelectInput>
          <SelectInput label="Temperature" value={temperature} onChange={(e) => setTemperature(e.target.value as Temperature)}>
            {TEMPERATURES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </SelectInput>
        </div>

        <Switch checked={caffeineFree} onChange={setCaffeineFree} label="Caffeine free" onText="Caffeine free" offText="Contains caffeine" />

        <TextInput label="Tags" value={tags} onChange={setTags} helper="Comma separated, such as sweet, creamy, strong. They help the mood suggester find this item." />

        {choices.length > 0 && (
          <ChoiceGroup
            legend="Choices offered"
            type="checkbox"
            name="item-groups"
            layout="stack"
            value={groupIds}
            onChange={(next) => setGroupIds(next.map(Number))}
            choices={choices.map((g) => ({ value: g.id, label: g.name, hint: `${g.options.length} options` }))}
          />
        )}

        <ImagePicker label="Photo" value={image} onChange={setImage} folder="menu" />

        <div className="grid gap-1 border-t border-line pt-4">
          <Switch checked={!hidden} onChange={(v) => setHidden(!v)} label="Shown on the menu" onText="Shown on the menu" offText="Hidden from the menu" />
          <Switch checked={soldOut} onChange={setSoldOut} label="Sold out" onText="Sold out" offText="Available" />
        </div>

        {saver.error && (
          <p role="alert" className="text-body-sm text-danger">
            {saver.error}
          </p>
        )}

        <div className="sticky -bottom-4 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-line bg-surface px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:-mx-6 md:px-6">
          <Button size="xl" busy={saver.busy} onClick={() => void save()} disabled={name.trim().length === 0}>
            {item ? 'Save changes' : 'Add to menu'}
          </Button>
          <Button variant="secondary" size="xl" onClick={onClose}>
            Cancel
          </Button>
        </div>

        {item && (
          <ConfirmDelete
            confirmText={`Delete ${item.name} from the menu? Orders already placed keep their record of it.`}
            busy={saver.busy}
            onConfirm={async () => {
              const ok = await saver.run(() => api(`/dashboard/items/${item.id}`, { method: 'DELETE' }).then(() => undefined))
              if (ok) {
                onChanged()
                onClose()
              }
            }}
          />
        )}
      </div>
    </Sheet>
  )
}
