import { formatCardNumber, formatExpiry, type CardErrors, type CardFields } from '../../lib/card'
import { TextField } from '../ui/Fields'

interface CardFormProps {
  fields: CardFields
  errors: CardErrors
  onChange: (fields: CardFields) => void
  disabled?: boolean
}

/** Card entry for the prototype. Nothing typed here leaves the browser (see lib/card.ts). */
export function CardForm({ fields, errors, onChange, disabled }: CardFormProps) {
  const set = (patch: Partial<CardFields>) => onChange({ ...fields, ...patch })
  return (
    <div className="grid gap-4">
      <p className="rounded-md border border-line bg-surface px-4 py-3 text-body-sm text-muted">
        Prototype payment. No card is charged and nothing you type here is sent anywhere. To try it, use{' '}
        <span className="font-semibold text-ink tnum">4242 4242 4242 4242</span>, any future date and any 3 digits.
      </p>
      <TextField
        label="Name on card"
        autoComplete="cc-name"
        value={fields.name}
        onChange={(e) => set({ name: e.target.value })}
        error={errors.name}
        disabled={disabled}
        maxLength={60}
      />
      <TextField
        label="Card number"
        inputMode="numeric"
        autoComplete="cc-number"
        placeholder="1234 5678 9012 3456"
        value={fields.number}
        onChange={(e) => set({ number: formatCardNumber(e.target.value) })}
        error={errors.number}
        disabled={disabled}
        className="tnum"
      />
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Expiry"
          inputMode="numeric"
          autoComplete="cc-exp"
          placeholder="MM/YY"
          value={fields.expiry}
          onChange={(e) => set({ expiry: formatExpiry(e.target.value) })}
          error={errors.expiry}
          disabled={disabled}
          maxLength={5}
          className="tnum"
        />
        <TextField
          label="Security code"
          inputMode="numeric"
          autoComplete="cc-csc"
          placeholder="123"
          value={fields.cvc}
          onChange={(e) => set({ cvc: e.target.value.replace(/\D/g, '').slice(0, 4) })}
          error={errors.cvc}
          disabled={disabled}
          maxLength={4}
          className="tnum"
        />
      </div>
    </div>
  )
}
