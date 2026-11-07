import { filsToAedInput, parseAedToFils } from '@shared/admin'
import { ImagePlus, Trash2 } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode, type SelectHTMLAttributes } from 'react'
import { errorMessage } from '../../lib/api'
import { cx } from '../../lib/cx'
import { uploadDashboardImage } from '../../lib/image'
import { Button } from '../ui/Button'
import { inputClass } from '../ui/Fields'
import { Mountains } from '../ui/Art'

/* Form pieces for the dashboard screens. They follow the same rules as the customer app: visible
   labels, 44px targets, and state carried by words as well as colour. */

export function Field({ label, helper, error, children, htmlFor }: { label: string; helper?: string; error?: string | null; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-body-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-body-sm text-danger">{error}</p>
      ) : helper ? (
        <p className="mt-1.5 text-body-sm text-muted">{helper}</p>
      ) : null}
    </div>
  )
}

export function TextInput({ label, value, onChange, helper, error, maxLength, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; helper?: string; error?: string | null; maxLength?: number; placeholder?: string; type?: string
}) {
  const id = useId()
  return (
    <Field label={label} helper={helper} error={error} htmlFor={id}>
      <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} maxLength={maxLength} placeholder={placeholder} className={cx(inputClass, error ? 'border-danger' : 'border-control')} />
    </Field>
  )
}

export function TextAreaInput({ label, value, onChange, helper, maxLength, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; helper?: string; maxLength?: number; rows?: number }) {
  const id = useId()
  return (
    <Field label={label} helper={helper} htmlFor={id}>
      <textarea id={id} rows={rows} value={value} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} className={cx(inputClass, 'resize-y border-control')} />
    </Field>
  )
}

export function SelectInput({ label, helper, children, ...rest }: { label: string; helper?: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId()
  return (
    <Field label={label} helper={helper} htmlFor={id}>
      <select id={id} className={cx(inputClass, 'border-control')} {...rest}>
        {children}
      </select>
    </Field>
  )
}

/** A price typed in dirhams ("32.50"), kept as whole fils. It shows an error until the text is a price. */
export function AedInput({ label, fils, onChange, helper, allowZero = true }: { label: string; fils: number; onChange: (fils: number) => void; helper?: string; allowZero?: boolean }) {
  const [text, setText] = useState(filsToAedInput(fils))
  const [error, setError] = useState<string | null>(null)
  // Follow outside changes (for example switching to another item) without fighting what is being typed.
  const last = useRef(fils)
  useEffect(() => {
    if (fils !== last.current) {
      last.current = fils
      setText(filsToAedInput(fils))
      setError(null)
    }
  }, [fils])
  const id = useId()
  return (
    <Field label={label} helper={helper} error={error} htmlFor={id}>
      <div className="relative">
        <input
          id={id}
          inputMode="decimal"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            const parsed = parseAedToFils(e.target.value)
            if (parsed == null || (!allowZero && parsed === 0)) setError('Enter a price such as 25 or 32.50.')
            else {
              setError(null)
              last.current = parsed
              onChange(parsed)
            }
          }}
          className={cx(inputClass, 'pr-14 tnum', error ? 'border-danger' : 'border-control')}
        />
        <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-label font-semibold uppercase text-muted">AED</span>
      </div>
    </Field>
  )
}

export function NumberInput({ label, value, onChange, min, max, suffix, helper }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; suffix?: string; helper?: string }) {
  const id = useId()
  return (
    <Field label={label} helper={helper} htmlFor={id}>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => onChange(Math.min(max, Math.max(min, Math.floor(Number(e.target.value) || 0))))}
          className={cx(inputClass, 'border-control tnum', suffix && 'pr-16')}
        />
        {suffix && <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-label font-semibold uppercase text-muted">{suffix}</span>}
      </div>
    </Field>
  )
}

/** An on/off switch. The words carry the state too, so it never relies on colour. */
export function Switch({ checked, onChange, label, onText = 'On', offText = 'Off', disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; onText?: string; offText?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx('inline-flex min-h-11 items-center gap-2.5 rounded-md pr-1 text-body-sm font-semibold transition-colors disabled:opacity-50', checked ? 'text-ink' : 'text-muted')}
    >
      <span className={cx('relative h-6 w-11 shrink-0 rounded-full border transition-colors', checked ? 'border-accent bg-accent' : 'border-control bg-transparent')} aria-hidden="true">
        <span className={cx('absolute top-0.5 size-4.5 rounded-full transition-all', checked ? 'left-5.5 bg-on-accent' : 'left-0.5 bg-control')} />
      </span>
      <span className="min-w-12 text-left">{checked ? onText : offText}</span>
    </button>
  )
}

/** Delete needs a second, deliberate press. Nothing is removed on the first tap. */
export function ConfirmDelete({ label = 'Delete', confirmText, onConfirm, busy }: { label?: string; confirmText: string; onConfirm: () => void | Promise<void>; busy?: boolean }) {
  const [asking, setAsking] = useState(false)
  if (!asking) {
    return (
      <Button variant="danger" size="md" onClick={() => setAsking(true)}>
        <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
        {label}
      </Button>
    )
  }
  return (
    <div role="alertdialog" aria-label="Confirm delete" className="rounded-md border border-danger p-3">
      <p className="text-body-sm text-ink">{confirmText}</p>
      <div className="mt-3 flex gap-2">
        <Button variant="danger" size="md" busy={busy} onClick={() => void onConfirm()}>
          Yes, delete
        </Button>
        <Button variant="secondary" size="md" onClick={() => setAsking(false)}>
          Keep it
        </Button>
      </div>
    </div>
  )
}

/** Pick a picture, shrink it in the browser, upload it, and keep its address. */
export function ImagePicker({ label, value, onChange, folder, helper }: { label: string; value: string | null; onChange: (url: string | null) => void; folder: 'menu' | 'promo'; helper?: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const id = useId()
  return (
    <div>
      <p className="mb-1.5 text-body-sm font-semibold text-ink">{label}</p>
      <div className="flex items-center gap-4">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-lg border border-line bg-raised">
          {value ? <img src={value} alt="" className="absolute inset-0 size-full object-cover" /> : <Mountains />}
        </div>
        <div className="min-w-0">
          <input
            id={id}
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              setBusy(true)
              setError(null)
              try {
                onChange(await uploadDashboardImage(file, folder))
              } catch (err) {
                setError(errorMessage(err))
              } finally {
                setBusy(false)
              }
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="md" busy={busy} onClick={() => input.current?.click()}>
              <ImagePlus size={16} strokeWidth={1.75} aria-hidden="true" />
              {value ? 'Change photo' : 'Add photo'}
            </Button>
            {value && (
              <Button variant="tertiary" size="md" onClick={() => onChange(null)}>
                Remove
              </Button>
            )}
          </div>
          {error ? <p className="mt-1.5 text-body-sm text-danger">{error}</p> : <p className="mt-1.5 text-body-sm text-muted">{helper ?? 'JPEG, PNG or WebP. It is shrunk before it uploads.'}</p>}
        </div>
      </div>
    </div>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { key: T; label: string; count?: number }[]; value: T; onChange: (key: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none]">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          type="button"
          aria-selected={value === tab.key}
          onClick={() => onChange(tab.key)}
          className={cx('min-h-12 shrink-0 px-4 text-body font-semibold transition-colors', value === tab.key ? 'text-ink shadow-[inset_0_-2px_0_var(--c-accent)]' : 'text-muted hover:text-ink')}
        >
          {tab.label}
          {tab.count != null && <span className="ml-2 text-body-sm font-normal text-muted tnum">{tab.count}</span>}
        </button>
      ))}
    </div>
  )
}

/** Page-level feedback for the dashboard's save actions. */
export function useSaver() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (fn: () => Promise<void>): Promise<boolean> => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      return true
    } catch (e) {
      setError(errorMessage(e))
      return false
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, setError, run }
}
