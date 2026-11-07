import { Logo } from './Logo'
import { LoadingLine } from './ui/Art'

/** Shown while the app checks who is signed in. The full logo, on the page's own solid ground. */
export function Splash({ label = 'Loading Altitude' }: { label?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-6">
      <div className="flex w-full max-w-48 animate-fade-in flex-col items-center gap-8">
        <Logo variant="full" height={132} />
        <LoadingLine label={label} />
      </div>
    </div>
  )
}
