import { Moon, Sun } from 'lucide-react'
import { cx } from '../lib/cx'
import { useTheme } from '../lib/theme'

/** Shows the icon of the theme you would switch to. The choice is remembered. */
export function ThemeToggle({ className, withLabel = false }: { className?: string; withLabel?: boolean }) {
  const { theme, toggle } = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      className={cx(
        'inline-flex min-h-11 items-center justify-center gap-3 rounded-md text-muted transition-colors hover:bg-raised hover:text-ink',
        withLabel ? 'px-3' : 'size-11',
        className,
      )}
    >
      {theme === 'dark' ? <Sun size={20} strokeWidth={1.75} aria-hidden="true" /> : <Moon size={20} strokeWidth={1.75} aria-hidden="true" />}
      {withLabel && <span className="text-body-sm font-semibold">{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span>}
    </button>
  )
}
