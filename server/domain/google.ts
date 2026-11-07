/*
 * What to do with a Google ID token once google-auth-library has checked its signature, expiry and audience.
 * This part decides who may come in and what we keep, and it is pure so it can be tested without Google.
 */

export interface GoogleClaims {
  sub?: string
  email?: string
  email_verified?: boolean
  name?: string
  given_name?: string
  picture?: string
}

export interface GoogleProfile {
  sub: string
  email: string
  name: string
  firstName: string
  pictureUrl: string | null
  isDemo: false
}

export type GoogleDecision = { ok: true; profile: GoogleProfile } | { ok: false; status: number; code: string; message: string }

const clean = (text: string | undefined, max: number): string => (text ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)

/** A Google OAuth client id looks like 1234567890-abc123def456.apps.googleusercontent.com. */
export function looksLikeGoogleClientId(id: string): boolean {
  return /^\d{6,}-[a-z0-9]+\.apps\.googleusercontent\.com$/i.test(id.trim())
}

/**
 * Turns verified claims into a profile, or says why the person cannot sign in. A verified email is required.
 * When `allowedDomains` is not empty, the email must end in one of them (exact match, lower case).
 */
export function decideGoogleSignIn(claims: GoogleClaims | undefined, allowedDomains: string[]): GoogleDecision {
  if (!claims?.sub || !claims.email || claims.email_verified !== true) {
    return { ok: false, status: 401, code: 'unverified_email', message: 'Use a Google account with a verified email.' }
  }
  const email = claims.email.trim().toLowerCase()

  if (allowedDomains.length > 0) {
    const domain = email.split('@').pop() ?? ''
    if (!allowedDomains.includes(domain)) {
      return {
        ok: false,
        status: 403,
        code: 'domain_not_allowed',
        message: `Sign in with your university account (${allowedDomains.map((d) => `@${d}`).join(', ')}).`,
      }
    }
  }

  const name = clean(claims.name, 80) || email.split('@')[0]
  const firstName = clean(claims.given_name, 40) || name.split(/\s+/)[0]
  // Only a plain https picture address is kept; anything else is dropped rather than shown.
  const picture = claims.picture && /^https:\/\/[^\s"'<>]{1,500}$/i.test(claims.picture) ? claims.picture : null

  return { ok: true, profile: { sub: `google:${claims.sub}`, email, name, firstName, pictureUrl: picture, isDemo: false } }
}
