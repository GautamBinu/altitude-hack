/**
 * A guest has no account, so the posts they send are remembered on this device by a private token the server
 * gave them. The token only lets this device check on a post and take it back. It is not a password.
 */
const KEY = 'altitude.posts.v1'

interface Saved {
  id: number
  token: string
}

export function savedPostTokens(): Saved[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter((p): p is Saved => !!p && typeof p.id === 'number' && typeof p.token === 'string').slice(-20)
  } catch {
    return []
  }
}

export function rememberPost(id: number, token: string): void {
  try {
    const next = [...savedPostTokens().filter((p) => p.id !== id), { id, token }].slice(-20)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* private mode or full storage: the post still goes to the team, we just cannot show its status later */
  }
}

export function forgetPost(id: number): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(savedPostTokens().filter((p) => p.id !== id)))
  } catch {
    /* nothing to do */
  }
}

export function tokenFor(id: number): string | null {
  return savedPostTokens().find((p) => p.id === id)?.token ?? null
}
