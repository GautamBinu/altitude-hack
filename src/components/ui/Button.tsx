import type { ButtonHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router'
import { cx } from '../../lib/cx'

type Variant = 'primary' | 'secondary' | 'tertiary' | 'danger'
type Size = 'md' | 'lg' | 'xl'

interface StyleOptions {
  variant?: Variant
  size?: Size
  block?: boolean
}

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-md font-sans font-semibold leading-tight select-none ' +
  'transition-[background-color,border-color,color,transform,filter] duration-150 ease-out active:translate-y-px ' +
  'disabled:active:translate-y-0 aria-disabled:pointer-events-none'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-on-accent hover:brightness-110 ' +
    'disabled:bg-raised disabled:text-muted disabled:brightness-100 disabled:border disabled:border-line',
  secondary:
    'border border-control text-ink bg-transparent hover:bg-raised ' +
    'disabled:text-muted disabled:border-line disabled:hover:bg-transparent',
  tertiary: 'text-ink underline-offset-4 hover:underline disabled:text-muted disabled:no-underline',
  danger:
    'border border-danger text-danger bg-transparent hover:bg-raised ' +
    'disabled:text-muted disabled:border-line',
}

const SIZES: Record<Size, string> = {
  md: 'min-h-11 px-4 text-body',
  lg: 'min-h-12 px-5 text-title',
  xl: 'min-h-14 px-6 text-title',
}

export function buttonClass({ variant = 'primary', size = 'lg', block = false }: StyleOptions = {}): string {
  return cx(BASE, VARIANTS[variant], SIZES[size], block && 'w-full')
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, StyleOptions {
  busy?: boolean
}

export function Button({ variant, size, block, busy, className, children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(buttonClass({ variant, size, block }), className)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {children}
    </button>
  )
}

interface LinkButtonProps extends LinkProps, StyleOptions {}

export function LinkButton({ variant, size, block, className, ...rest }: LinkButtonProps) {
  return <Link className={cx(buttonClass({ variant, size, block }), className)} {...rest} />
}
