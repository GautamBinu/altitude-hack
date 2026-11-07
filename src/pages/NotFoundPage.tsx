import { LinkButton } from '../components/ui/Button'
import { EmptyState } from '../components/ui/States'
import { useDocumentTitle } from '../lib/useDocumentTitle'

export function NotFoundPage() {
  useDocumentTitle('Page not found')
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <EmptyState title="We can't find that page" action={<LinkButton to="/">Back to the start</LinkButton>}>
        The link may be old or mistyped.
      </EmptyState>
    </div>
  )
}
