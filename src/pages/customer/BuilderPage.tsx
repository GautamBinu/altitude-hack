import {
  allows,
  cleanCreationName,
  creationKey,
  defaultConfig,
  describeCreation,
  MAX_CREATION_NAME,
  suggestName,
  type BuilderData,
  type BuilderOptionView,
  type CommunityCreation,
  type Described,
  type SavedCreation,
} from '@shared/builder'
import { formatAedNumber } from '@shared/money'
import type { CreationConfig } from '@shared/types'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Cup } from '../../components/builder/Cup'
import { CommunityBoard, useCommunity } from '../../components/builder/Community'
import { Button } from '../../components/ui/Button'
import { StatusChip } from '../../components/ui/Chip'
import { ChoiceGroup, TextField, type Choice } from '../../components/ui/Fields'
import { ErrorState } from '../../components/ui/States'
import { LoadingLine, Mountains } from '../../components/ui/Art'
import { PriceDelta, Price } from '../../components/ui/Price'
import { useToast } from '../../components/ui/Toast'
import { api, errorMessage } from '../../lib/api'
import { cx } from '../../lib/cx'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { useBuilder } from '../../state/builder'
import { useCart } from '../../state/cart'
import { useOrders } from '../../state/orders'
import { useSession } from '../../state/session'

/** After a choice changes, anything that can no longer be made at this temperature is dropped. */
function settle(config: CreationConfig, data: BuilderData): CreationConfig {
  const next = { ...config }
  const base = data.bases.find((b) => b.id === next.baseId)
  if (base && !allows(base, next.temperature)) next.temperature = base.temperature === 'iced' ? 'iced' : 'hot'
  const flavour = data.flavours.find((f) => f.id === next.flavourId)
  if (flavour && !allows(flavour, next.temperature)) next.flavourId = null
  const topping = data.toppings.find((t) => t.id === next.toppingId)
  if (topping && !allows(topping, next.temperature)) next.toppingId = null
  return next
}

const priceHint = (fils: number) => (fils > 0 ? <PriceDelta fils={fils} /> : undefined)
const onlyHint = (o: BuilderOptionView) => <span className="text-body-sm text-muted">{o.temperature === 'iced' ? 'Iced only' : 'Hot only'}</span>

function optionChoices(list: BuilderOptionView[], temperature: 'hot' | 'iced'): Choice[] {
  return list.map((o) => {
    const ok = allows(o, temperature)
    return { value: o.id, label: o.name, hint: ok ? priceHint(o.priceFils) : onlyHint(o), disabled: !ok }
  })
}

const STATUS_TEXT = {
  pending: 'Waiting for review',
  approved: 'On the community board',
} as const

export function BuilderPage() {
  useDocumentTitle('Create your own coffee')
  const { data, status, error, offline, reload } = useBuilder()
  const { user } = useSession()
  const { active } = useOrders()
  const cart = useCart()
  const toast = useToast()
  const community = useCommunity()
  const [params] = useSearchParams()

  const [config, setConfig] = useState<CreationConfig | null>(null)
  const [name, setName] = useState('')
  const [saved, setSaved] = useState<SavedCreation | null>(null)
  const [busy, setBusy] = useState<'save' | 'share' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [startError, setStartError] = useState<string | null>(null)

  // Where to start: a creation to change (yours or the community's), or the default latte.
  const fromCommunity = params.get('community')
  const fromSaved = params.get('creation')
  useEffect(() => {
    if (!data || config) return
    let cancelled = false
    const begin = (start: CreationConfig, startName = '', existing: SavedCreation | null = null) => {
      if (cancelled) return
      setConfig(settle(start, data))
      setName(startName)
      setSaved(existing)
    }
    if (fromCommunity) {
      api<{ creations: CommunityCreation[] }>('/builder/community')
        .then((r) => {
          const found = r.creations.find((c) => c.id === Number(fromCommunity))
          if (found) begin(found.config, found.name)
          else {
            setStartError("That community coffee isn't on the board any more. Here is a fresh one.")
            begin(defaultConfig(data))
          }
        })
        .catch(() => begin(defaultConfig(data)))
    } else if (fromSaved && user) {
      api<{ creations: SavedCreation[] }>('/me/creations')
        .then((r) => {
          const found = r.creations.find((c) => c.id === Number(fromSaved))
          if (found) begin(found.config, found.name, found)
          else begin(defaultConfig(data))
        })
        .catch(() => begin(defaultConfig(data)))
    } else {
      begin(defaultConfig(data))
    }
    return () => {
      cancelled = true
    }
  }, [data, config, fromCommunity, fromSaved, user])

  const recipe = useMemo<Described | null>(() => {
    if (!config || !data) return null
    const result = describeCreation(config, data)
    return result.ok ? result : null
  }, [config, data])
  const problem = useMemo(() => {
    if (!config || !data) return null
    const result = describeCreation(config, data)
    return result.ok ? null : result.message
  }, [config, data])

  const suggested = recipe ? suggestName(recipe) : ''
  const finalName = cleanCreationName(name) || suggested

  const change = (patch: Partial<CreationConfig>) => {
    if (!data) return
    setConfig((current) => (current ? settle({ ...current, ...patch }, data) : current))
    setActionError(null)
  }

  // A saved creation only counts as saved while the recipe on screen is the one that was saved.
  const isSaved = !!saved && !!recipe && creationKey({ ...saved.config, name: saved.name }) === creationKey({ ...recipe.config, name: finalName })
  const shown = isSaved ? saved : null

  if (status === 'error') {
    return <ErrorState title="The builder didn't load" message={error ?? ''} offline={offline} onRetry={reload} className="max-w-xl" />
  }
  if (!data || !config) {
    return (
      <div role="status" className="max-w-md pt-4">
        <LoadingLine label="Setting up the builder" />
      </div>
    )
  }
  if (data.bases.length === 0) {
    return (
      <div className="max-w-xl">
        <h1 className="text-display-lg font-bold">Create your own coffee</h1>
        <p className="mt-3 text-body text-muted">The builder is switched off at the moment. Have a look at the menu instead.</p>
      </div>
    )
  }

  const base = data.bases.find((b) => b.id === config.baseId)
  const flavour = data.flavours.find((f) => f.id === config.flavourId)
  const takesMilk = !!base?.usesMilk || !!flavour?.usesMilk
  const stickyTop = active.length > 0 ? 'top-[7rem] md:top-14' : 'top-14 md:top-0'

  const save = async () => {
    if (!recipe) return
    setBusy('save')
    setActionError(null)
    try {
      if (shown) {
        await api(`/me/creations/${shown.id}`, { method: 'DELETE' })
        setSaved(null)
        toast.show(`${shown.name} removed from your favourites.`)
      } else {
        const r = await api<{ creation: SavedCreation }>('/me/creations', { body: { name: finalName, config: recipe.config } })
        setSaved(r.creation)
        toast.show(`${r.creation.name} saved to your favourites.`)
      }
    } catch (e) {
      setActionError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const share = async () => {
    if (!recipe) return
    setBusy('share')
    setActionError(null)
    try {
      let target = shown
      if (!target) {
        target = (await api<{ creation: SavedCreation }>('/me/creations', { body: { name: finalName, config: recipe.config } })).creation
      }
      const r = await api<{ creation: SavedCreation }>(`/me/creations/${target.id}/submit`, { method: 'POST', body: {} })
      setSaved(r.creation)
      toast.show('Sent to the team for review.')
    } catch (e) {
      setActionError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const addToOrder = () => {
    if (!recipe) return
    cart.addCreation({ ...recipe.config, name: finalName }, 1)
    toast.show(`${finalName} added to your order.`)
  }

  const minutes = recipe ? Math.max(1, Math.round(recipe.prepSeconds / 60)) : 0

  return (
    <div className="pb-28 lg:pb-0">
      <h1 className="text-display-lg font-bold text-ink">Create your own coffee</h1>
      <p className="mt-2 max-w-xl text-body text-muted">Pick what goes in. The cup and the price change as you go.</p>
      {startError && <p role="status" className="mt-3 text-body-sm text-muted">{startError}</p>}

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start lg:gap-12">
        {/* The cup and the price. On a phone it stays at the top while you scroll the steps. */}
        <aside
          aria-label="Your coffee"
          className={cx('sticky z-10 -mx-4 border-b border-line bg-bg px-4 py-3 md:-mx-8 md:px-8', stickyTop, 'lg:top-8 lg:order-2 lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0')}
        >
          <div className="flex items-center overflow-hidden rounded-lg border border-line bg-surface lg:block">
            {/* The ridge sits behind the cup only, so the words below it stay on a plain surface. */}
            <div className="relative shrink-0 self-stretch px-3 py-2 lg:p-6">
              <div className="absolute inset-x-0 bottom-0 hidden h-1/2 opacity-80 lg:block" aria-hidden="true">
                <Mountains />
              </div>
              {recipe && <Cup recipe={recipe} className="relative h-28 w-auto lg:mx-auto lg:h-64" />}
            </div>
            <div className="min-w-0 flex-1 p-3 lg:border-t lg:border-line lg:p-5">
              <div className="lg:text-center">
                <p className="truncate font-display text-headline font-semibold leading-tight text-ink">{finalName || 'Your coffee'}</p>
                {recipe ? (
                  <>
                    <p className="mt-1 hidden text-body-sm text-muted lg:block">{recipe.modifiers.join(' · ')}</p>
                    <div className="mt-2 flex items-baseline gap-3 lg:justify-center">
                      <Price fils={recipe.unitPriceFils} size="lg" />
                      <span className="text-body-sm text-muted">About {minutes} min to make</span>
                    </div>
                  </>
                ) : (
                  <p role="alert" className="mt-1 text-body-sm text-danger">{problem}</p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 hidden gap-3 lg:grid">
            <Actions
              recipeReady={!!recipe}
              signedIn={!!user}
              shown={shown}
              busy={busy}
              onAdd={addToOrder}
              onSave={() => void save()}
              onShare={() => void share()}
              error={actionError}
            />
          </div>
        </aside>

        <div className="grid gap-7 lg:order-1">
          <ChoiceGroup
            legend="Base"
            note={base?.name}
            type="radio"
            name="base"
            value={[config.baseId]}
            onChange={([v]) => change({ baseId: Number(v) })}
            choices={data.bases.map((b) => ({
              value: b.id,
              label: b.name,
              hint: <span className="text-body-sm tnum text-muted">{formatAedNumber(b.priceFils)} AED</span>,
            }))}
          />

          <ChoiceGroup
            legend="Hot or iced"
            note={config.temperature === 'iced' ? 'Iced' : 'Hot'}
            type="radio"
            name="temperature"
            value={[config.temperature]}
            onChange={([v]) => change({ temperature: v === 'iced' ? 'iced' : 'hot' })}
            choices={[
              { value: 'hot', label: 'Hot', disabled: !!base && !allows(base, 'hot'), hint: base && !allows(base, 'hot') ? 'Iced only' : undefined },
              { value: 'iced', label: 'Iced', disabled: !!base && !allows(base, 'iced'), hint: base && !allows(base, 'iced') ? 'Hot only' : undefined },
            ]}
          />

          {takesMilk && data.milks.length > 0 && (
            <ChoiceGroup
              legend="Milk"
              note={data.milks.find((m) => m.id === config.milkOptionId)?.name ?? data.milks.find((m) => m.isDefault)?.name}
              type="radio"
              name="milk"
              value={[config.milkOptionId ?? data.milks.find((m) => m.isDefault)?.id ?? data.milks[0].id]}
              onChange={([v]) => change({ milkOptionId: Number(v) })}
              choices={data.milks.map((m) => ({ value: m.id, label: m.name, hint: priceHint(m.priceDeltaFils) }))}
            />
          )}

          {data.flavours.length > 0 && (
            <ChoiceGroup
              legend="Flavour"
              note={flavour?.name ?? 'None'}
              type="radio"
              name="flavour"
              value={[config.flavourId ?? 0]}
              onChange={([v]) => change({ flavourId: Number(v) || null })}
              choices={[{ value: 0, label: 'None' }, ...optionChoices(data.flavours, config.temperature)]}
            />
          )}

          {data.shot && (
            <ChoiceGroup
              legend="Extra shot"
              note={config.extraShots === 0 ? 'None' : config.extraShots === 1 ? '1 shot' : `${config.extraShots} shots`}
              type="radio"
              name="shots"
              value={[config.extraShots]}
              onChange={([v]) => change({ extraShots: Number(v) })}
              choices={Array.from({ length: Math.min(data.maxExtraShots, 2) + 1 }, (_, n) => ({
                value: n,
                label: n === 0 ? 'None' : n === 1 ? '1 shot' : `${n} shots`,
                hint: n > 0 ? priceHint(data.shot!.priceFils * n) : undefined,
              }))}
            />
          )}

          {data.sweetness.length > 0 && (
            <ChoiceGroup
              legend="Sweetness"
              note={data.sweetness.find((s) => s.id === config.sweetnessId)?.name}
              type="radio"
              name="sweetness"
              value={[config.sweetnessId ?? 0]}
              onChange={([v]) => change({ sweetnessId: Number(v) || null })}
              choices={data.sweetness.map((s) => ({ value: s.id, label: s.name, hint: priceHint(s.priceFils) }))}
            />
          )}

          {data.toppings.length > 0 && (
            <ChoiceGroup
              legend="Topping"
              note={data.toppings.find((t) => t.id === config.toppingId)?.name ?? 'None'}
              type="radio"
              name="topping"
              value={[config.toppingId ?? 0]}
              onChange={([v]) => change({ toppingId: Number(v) || null })}
              choices={[{ value: 0, label: 'None' }, ...optionChoices(data.toppings, config.temperature)]}
            />
          )}

          <TextField
            label="Name your coffee"
            value={name}
            maxLength={MAX_CREATION_NAME}
            placeholder={suggested || 'My coffee'}
            onChange={(e) => {
              setName(e.target.value)
              setActionError(null)
            }}
            helper="Leave it empty to use the suggested name. Up to 40 letters."
          />

          {shown && shown.submitStatus !== 'none' && (
            <p className="flex flex-wrap items-center gap-2 text-body-sm text-muted">
              {shown.submitStatus === 'rejected' ? (
                <>
                  <StatusChip tone="warning">Not approved</StatusChip>
                  {shown.rejectReason}
                </>
              ) : (
                <StatusChip tone={shown.submitStatus === 'approved' ? 'success' : 'neutral'}>{STATUS_TEXT[shown.submitStatus]}</StatusChip>
              )}
            </p>
          )}

          {/* On a phone the actions live in a bar above the tab bar. */}
          <div className="lg:hidden">
            {actionError && <p role="alert" className="mb-3 text-body-sm text-danger">{actionError}</p>}
            <div className="grid gap-3">
              {user ? (
                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" size="md" busy={busy === 'save'} disabled={!recipe} onClick={() => void save()}>
                    {shown ? 'Saved. Remove' : 'Save to favourites'}
                  </Button>
                  <ShareButton shown={shown} busy={busy === 'share'} disabled={!recipe} onClick={() => void share()} />
                </div>
              ) : (
                <p className="text-body-sm text-muted">
                  <Link to="/signin" state={{ from: '/build' }} className="font-semibold text-ink underline underline-offset-4">
                    Sign in
                  </Link>{' '}
                  to save this one or share it with the community.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-12">
        <CommunityBoard creations={community} heading="From the community" />
        {community.length > 0 && <p className="mt-3 text-body-sm text-muted">Share yours and the best ones could become a signature drink.</p>}
      </div>

      {/* Phone: price and the main action, above the tab bar. */}
      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 border-t border-line bg-surface px-4 py-3 md:bottom-0 md:left-22 lg:hidden">
        <div className="flex items-center justify-between gap-4">
          {recipe ? <Price fils={recipe.unitPriceFils} size="lg" /> : <span />}
          <Button size="lg" disabled={!recipe} onClick={addToOrder}>
            Add to order
          </Button>
        </div>
      </div>
    </div>
  )
}

function ShareButton({ shown, busy, disabled, onClick }: { shown: SavedCreation | null; busy: boolean; disabled: boolean; onClick: () => void }) {
  const status = shown?.submitStatus
  if (status === 'pending' || status === 'approved') {
    return <StatusChip tone={status === 'approved' ? 'success' : 'neutral'}>{STATUS_TEXT[status]}</StatusChip>
  }
  return (
    <Button variant="tertiary" size="md" busy={busy} disabled={disabled} onClick={onClick}>
      {status === 'rejected' ? 'Share again' : 'Share with the community'}
    </Button>
  )
}

function Actions({
  recipeReady,
  signedIn,
  shown,
  busy,
  onAdd,
  onSave,
  onShare,
  error,
}: {
  recipeReady: boolean
  signedIn: boolean
  shown: SavedCreation | null
  busy: 'save' | 'share' | null
  onAdd: () => void
  onSave: () => void
  onShare: () => void
  error: string | null
}) {
  return (
    <>
      <Button size="xl" block disabled={!recipeReady} onClick={onAdd}>
        Add to order
      </Button>
      {signedIn ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="md" busy={busy === 'save'} disabled={!recipeReady} onClick={onSave}>
            {shown ? 'Saved. Remove' : 'Save to favourites'}
          </Button>
          <ShareButton shown={shown} busy={busy === 'share'} disabled={!recipeReady} onClick={onShare} />
        </div>
      ) : (
        <p className="text-body-sm text-muted">
          <Link to="/signin" state={{ from: '/build' }} className="font-semibold text-ink underline underline-offset-4">
            Sign in
          </Link>{' '}
          to save this one or share it with the community.
        </p>
      )}
      {error && (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}
    </>
  )
}
