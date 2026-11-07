import type { MenuItem, MoodResponse } from '@shared/types'
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { CartBar } from '../../components/cart/CartBar'
import { ItemSheet } from '../../components/menu/ItemSheet'
import { MoodPicks } from '../../components/mood/MoodPicks'
import { Button, LinkButton } from '../../components/ui/Button'
import { inputClass } from '../../components/ui/Fields'
import { LoadingLine } from '../../components/ui/Art'
import { ErrorState } from '../../components/ui/States'
import { api, ApiError, errorMessage } from '../../lib/api'
import { cx } from '../../lib/cx'
import type { Selections } from '../../lib/pricing'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { useMenu } from '../../state/menu'

/** Examples that rotate in the empty box, and the ones offered under it. */
const EXAMPLES = [
  'Rainy, tired, need something sweet but not heavy',
  'Hot day, want something cold and fruity',
  'Finals week. Strong, and quick to make',
  'Cannot sleep, something calming with no caffeine',
  'Celebrating, I want a proper treat',
]
const TRY_THESE = ['Rainy and tired', 'Something cold and fruity', 'No caffeine, nothing too sweet', 'Surprise me']

function useRotatingPlaceholder(paused: boolean): string {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(() => setIndex((i) => (i + 1) % EXAMPLES.length), 4500)
    return () => window.clearInterval(id)
  }, [paused])
  return EXAMPLES[index]
}

type Result =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; text: string; response: MoodResponse }
  | { status: 'error'; message: string; offline: boolean }

export function MoodPage() {
  useDocumentTitle('What are you in the mood for?')
  const { itemsById, status: menuStatus } = useMenu()
  const [params, setParams] = useSearchParams()
  const [text, setText] = useState(params.get('q') ?? '')
  const [focused, setFocused] = useState(false)
  const [result, setResult] = useState<Result>({ status: 'idle' })
  const [sheet, setSheet] = useState<{ item: MenuItem; selections: Selections } | null>(null)
  const placeholder = useRotatingPlaceholder(focused || text !== '')
  const resultsRef = useRef<HTMLDivElement>(null)
  const latest = useRef(0)

  const ask = useCallback(async (raw: string) => {
    const value = raw.trim()
    if (value.length < 2) return
    const ticket = ++latest.current
    setResult({ status: 'loading' })
    try {
      const response = await api<MoodResponse>('/mood', { body: { text: value } })
      if (ticket !== latest.current) return
      setResult({ status: 'ready', text: value, response })
    } catch (e) {
      if (ticket !== latest.current) return
      setResult({ status: 'error', message: errorMessage(e), offline: e instanceof ApiError && e.isOffline })
    }
  }, [])

  // Arriving from the home screen with a question already typed.
  const firstQuestion = useRef(params.get('q'))
  useEffect(() => {
    if (firstQuestion.current) void ask(firstQuestion.current)
  }, [ask])

  // Move to the answer when it arrives, so a phone does not leave it below the keyboard.
  useEffect(() => {
    if (result.status === 'ready') resultsRef.current?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [result.status])

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    setParams(text.trim() ? { q: text.trim() } : {}, { replace: true })
    void ask(text)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }
  const tooShort = text.trim().length < 2

  return (
    <div className="mx-auto max-w-4xl pb-24 lg:pb-0">
      <h1 className="text-display-lg font-bold text-ink">What are you in the mood for?</h1>
      <p className="mt-2 max-w-xl text-body text-muted">Say it in your own words. We will pick three drinks from the menu.</p>

      <form onSubmit={submit} className="mt-6">
        <label htmlFor="mood-text" className="mb-1.5 block text-body-sm font-semibold text-ink">
          Your mood
        </label>
        <textarea
          id="mood-text"
          rows={3}
          maxLength={300}
          value={text}
          enterKeyHint="send"
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className={cx(inputClass, 'min-h-32 resize-none border-control text-title leading-snug')}
        />
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
          <Button type="submit" size="xl" busy={result.status === 'loading'} disabled={tooShort}>
            Find my drink
          </Button>
          <p className="text-body-sm text-muted tnum">{text.length} of 300</p>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-1 text-body-sm text-muted">
          <span className="mr-1">Try</span>
          {TRY_THESE.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setText(example)
                setParams({ q: example }, { replace: true })
                void ask(example)
              }}
              className="min-h-11 rounded-md px-2.5 font-semibold text-ink underline underline-offset-4 hover:bg-raised"
            >
              {example}
            </button>
          ))}
        </div>
      </form>

      <div ref={resultsRef} className="mt-8 scroll-mt-20" aria-live="polite" aria-busy={result.status === 'loading'}>
        {result.status === 'loading' && (
          <div role="status">
            <LoadingLine label="Looking through the menu" />
          </div>
        )}

        {result.status === 'error' && (
          <ErrorState title="We couldn't pick for you" message={result.message} offline={result.offline} onRetry={() => void ask(text)} />
        )}

        {result.status === 'ready' && (
          <section aria-labelledby="mood-results">
            <h2 id="mood-results" className="text-headline font-semibold text-ink">
              {result.response.picks.length === 0 ? 'Nothing to suggest right now' : 'Three for you'}
            </h2>
            {result.response.note && <p className="mt-1 text-body text-muted">{result.response.note}</p>}
            {result.response.picks.length === 0 ? (
              <div className="mt-4">
                <p className="text-body text-muted">Everything we serve is sold out at the moment. Check back soon, or browse the menu.</p>
                <LinkButton to="/menu" variant="secondary" size="md" className="mt-4">
                  See the menu
                </LinkButton>
              </div>
            ) : menuStatus !== 'ready' ? (
              <div role="status" className="mt-4">
                <LoadingLine label="Loading the menu" />
              </div>
            ) : (
              <div className="mt-4">
                <MoodPicks picks={result.response.picks} itemsById={itemsById} onCustomise={(item, selections) => setSheet({ item, selections })} />
                <p className="mt-6 text-body-sm text-muted">
                  Not quite right? Change your words above, or{' '}
                  <Link to="/menu" className="font-semibold text-ink underline underline-offset-4">
                    browse the whole menu
                  </Link>
                  .
                </p>
              </div>
            )}
          </section>
        )}
      </div>

      <CartBar />
      <ItemSheet item={sheet?.item ?? null} initialSelections={sheet?.selections} onClose={() => setSheet(null)} />
    </div>
  )
}
