import { Check, Minus, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cx } from '../../lib/cx'

/* ---------- Text input ---------- */

export const inputClass =
  'block w-full min-h-12 rounded-md border bg-raised px-3.5 py-3 text-body text-ink ' +
  'transition-[border-color,box-shadow] duration-150 focus:outline-none focus:border-accent focus:shadow-band ' +
  'disabled:text-muted disabled:cursor-not-allowed'

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label: string
  helper?: string
  error?: string | null
  className?: string
}

/** A visible label above, helper text below, errors that say what to fix. */
export function TextField({ label, helper, error, className, id, ...rest }: TextFieldProps) {
  const auto = useId()
  const inputId = id ?? auto
  const noteId = `${inputId}-note`
  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-1.5 block text-body-sm font-semibold text-ink">
        {label}
      </label>
      <input
        id={inputId}
        className={cx(inputClass, error ? 'border-danger' : 'border-control')}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || helper ? noteId : undefined}
        {...rest}
      />
      {error ? (
        <p id={noteId} className="mt-1.5 flex items-start gap-1.5 text-body-sm text-danger">
          <TriangleAlert size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : helper ? (
        <p id={noteId} className="mt-1.5 text-body-sm text-muted">
          {helper}
        </p>
      ) : null}
    </div>
  )
}

/* ---------- Choice group (radio or checkbox) ---------- */

export interface Choice {
  value: string | number
  label: string
  /** Small trailing text such as "+6 AED". */
  hint?: ReactNode
  disabled?: boolean
}

interface ChoiceGroupProps {
  legend: string
  type: 'radio' | 'checkbox'
  name: string
  choices: Choice[]
  value: (string | number)[]
  onChange: (next: (string | number)[]) => void
  /** Layout: chips wrap naturally; stack puts one choice per row. */
  layout?: 'chips' | 'stack' | 'split'
  /** Small text shown beside the legend, for example "Optional". */
  note?: string
}

/**
 * Native radios and checkboxes, restyled. Keyboard behaviour (arrows, space) comes from the browser.
 * The selected state is carried by a check mark and a heavier border, never by colour alone.
 */
export function ChoiceGroup({ legend, type, name, choices, value, onChange, layout = 'chips', note }: ChoiceGroupProps) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 flex w-full items-baseline justify-between gap-3 text-body-sm font-semibold text-ink">
        <span>{legend}</span>
        {note && <span className="font-normal text-muted">{note}</span>}
      </legend>
      <div
        className={cx(
          layout === 'chips' && 'flex flex-wrap gap-2',
          layout === 'stack' && 'grid gap-2',
          layout === 'split' && 'grid grid-cols-2 gap-2',
        )}
      >
        {choices.map((choice) => {
          const selected = value.includes(choice.value)
          return (
            <label key={choice.value} className={cx('relative', choice.disabled && 'opacity-50')}>
              <input
                type={type}
                name={name}
                value={choice.value}
                checked={selected}
                disabled={choice.disabled}
                className="peer sr-only"
                onChange={() => {
                  if (type === 'radio') onChange([choice.value])
                  else onChange(selected ? value.filter((v) => v !== choice.value) : [...value, choice.value])
                }}
              />
              <span
                className={cx(
                  'flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3.5 py-2 text-body transition-colors duration-150',
                  'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
                  layout !== 'chips' && 'w-full justify-between',
                  selected
                    ? 'border-accent bg-raised font-semibold text-ink shadow-[inset_0_0_0_1px_var(--c-accent)]'
                    : 'border-control text-ink hover:bg-raised',
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cx(
                      'grid size-5 shrink-0 place-items-center border',
                      type === 'radio' ? 'rounded-full' : 'rounded-sm',
                      selected ? 'border-accent bg-accent text-on-accent' : 'border-control',
                    )}
                    aria-hidden="true"
                  >
                    {selected && <Check size={14} strokeWidth={3} />}
                  </span>
                  {choice.label}
                </span>
                {choice.hint && <span className="text-body-sm font-normal text-muted">{choice.hint}</span>}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/* ---------- Quantity stepper ---------- */

interface StepperProps {
  value: number
  onChange: (next: number) => void
  /** When set, pressing minus at 1 removes instead of going to zero. */
  onRemove?: () => void
  min?: number
  max?: number
  label: string
}

export function Stepper({ value, onChange, onRemove, min = 1, max = 20, label }: StepperProps) {
  const atMin = value <= min
  const removes = atMin && !!onRemove
  return (
    <div role="group" aria-label={label} className="inline-flex w-fit items-center rounded-md border border-control">
      <button
        type="button"
        className="grid size-11 place-items-center rounded-l-md text-ink transition-colors hover:bg-raised disabled:text-muted disabled:hover:bg-transparent"
        onClick={() => (removes ? onRemove?.() : onChange(value - 1))}
        disabled={atMin && !onRemove}
        aria-label={removes ? `Remove ${label}` : `One fewer ${label}`}
      >
        {removes ? <Trash2 size={18} strokeWidth={1.75} aria-hidden="true" /> : <Minus size={18} strokeWidth={1.75} aria-hidden="true" />}
      </button>
      <span className="grid min-w-10 place-items-center text-title font-semibold tnum" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className="grid size-11 place-items-center rounded-r-md text-ink transition-colors hover:bg-raised disabled:text-muted disabled:hover:bg-transparent"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label={`One more ${label}`}
      >
        <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  )
}
