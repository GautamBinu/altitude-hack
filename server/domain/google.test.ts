import { describe, expect, it } from 'vitest'
import { decideGoogleSignIn, looksLikeGoogleClientId, type GoogleClaims } from './google'

const claims = (over: Partial<GoogleClaims> = {}): GoogleClaims => ({
  sub: '1098765432101234567',
  email: 'Maryam.Khan@rit.edu',
  email_verified: true,
  name: 'Maryam Khan',
  given_name: 'Maryam',
  picture: 'https://lh3.googleusercontent.com/a/abc=s96-c',
  ...over,
})

describe('who may sign in with Google', () => {
  it('accepts a verified account and keeps what the app needs', () => {
    const d = decideGoogleSignIn(claims(), [])
    expect(d.ok && d.profile).toEqual({
      sub: 'google:1098765432101234567',
      email: 'maryam.khan@rit.edu',
      name: 'Maryam Khan',
      firstName: 'Maryam',
      pictureUrl: 'https://lh3.googleusercontent.com/a/abc=s96-c',
      isDemo: false,
    })
  })

  it('refuses an account whose email Google has not verified', () => {
    for (const over of [{ email_verified: false }, { email_verified: undefined }, { email: undefined }, { sub: undefined }]) {
      const d = decideGoogleSignIn(claims(over), [])
      expect(d).toMatchObject({ ok: false, status: 401, code: 'unverified_email' })
    }
    expect(decideGoogleSignIn(undefined, [])).toMatchObject({ ok: false, status: 401 })
  })

  it('does not accept a claim that is only truthy', () => {
    expect(decideGoogleSignIn(claims({ email_verified: 'true' as unknown as boolean }), [])).toMatchObject({ ok: false })
    expect(decideGoogleSignIn(claims({ email_verified: 1 as unknown as boolean }), [])).toMatchObject({ ok: false })
  })

  it('limits sign-in to the allowed email domains when any are set', () => {
    expect(decideGoogleSignIn(claims(), ['rit.edu']).ok).toBe(true)
    expect(decideGoogleSignIn(claims({ email: 'x@RIT.EDU' }), ['rit.edu']).ok).toBe(true)
    expect(decideGoogleSignIn(claims({ email: 'x@g.rit.edu' }), ['rit.edu', 'g.rit.edu']).ok).toBe(true)
    const blocked = decideGoogleSignIn(claims({ email: 'someone@gmail.com' }), ['rit.edu'])
    expect(blocked).toMatchObject({ ok: false, status: 403, code: 'domain_not_allowed' })
    expect(!blocked.ok && blocked.message).toContain('@rit.edu')
  })

  it('does not let a look-alike domain through', () => {
    for (const email of ['x@rit.edu.evil.test', 'x@notrit.edu', 'x@evil.test', 'rit.edu@gmail.com', 'x@rit.edu@evil.test']) {
      expect(decideGoogleSignIn(claims({ email }), ['rit.edu']).ok, email).toBe(false)
    }
  })

  it('allows any verified account when no domains are set', () => {
    expect(decideGoogleSignIn(claims({ email: 'anyone@gmail.com' }), []).ok).toBe(true)
  })

  it('falls back to the email name and the first word of the name', () => {
    const noGiven = decideGoogleSignIn(claims({ given_name: undefined }), [])
    expect(noGiven.ok && noGiven.profile.firstName).toBe('Maryam')
    const noName = decideGoogleSignIn(claims({ name: undefined, given_name: undefined }), [])
    expect(noName.ok && noName.profile.name).toBe('maryam.khan')
    expect(noName.ok && noName.profile.firstName).toBe('maryam.khan')
  })

  it('tidies names: control characters, odd spacing and length', () => {
    const d = decideGoogleSignIn(claims({ name: '  Ma\u0000ryam \n  Khan  ', given_name: 'x'.repeat(100) }), [])
    expect(d.ok && d.profile.name).toBe('Ma ryam Khan')
    expect(d.ok && d.profile.firstName.length).toBe(40)
  })

  it('keeps only an https picture', () => {
    for (const picture of ['http://x.test/a.png', 'javascript:alert(1)', 'data:image/png;base64,AAAA', '//x.test/a.png', 'https://x.test/a b.png', 'https://x.test/"onerror=1']) {
      const d = decideGoogleSignIn(claims({ picture }), [])
      expect(d.ok && d.profile.pictureUrl, picture).toBeNull()
    }
    expect(decideGoogleSignIn(claims({ picture: undefined }), [])).toMatchObject({ ok: true, profile: { pictureUrl: null } })
  })

  it('keeps one account per Google id, whatever the email', () => {
    const a = decideGoogleSignIn(claims({ email: 'old@rit.edu' }), [])
    const b = decideGoogleSignIn(claims({ email: 'new@rit.edu' }), [])
    expect(a.ok && b.ok && a.profile.sub === b.profile.sub).toBe(true)
  })

  it('can never be mistaken for the demo account', () => {
    const d = decideGoogleSignIn(claims({ sub: 'demo:student' }), [])
    expect(d.ok && d.profile.sub).toBe('google:demo:student')
    expect(d.ok && d.profile.isDemo).toBe(false)
  })
})

describe('checking a client id', () => {
  it('knows a real-looking id from a typo', () => {
    expect(looksLikeGoogleClientId('123456789012-abc123def456ghi789.apps.googleusercontent.com')).toBe(true)
    expect(looksLikeGoogleClientId('  123456789012-abc123def456ghi789.apps.googleusercontent.com  ')).toBe(true)
    for (const bad of ['', 'abc', 'GOCSPX-secretvalue', '123456789012-abc.googleusercontent.com', 'xyz.apps.googleusercontent.com', 'https://accounts.google.com']) {
      expect(looksLikeGoogleClientId(bad), bad).toBe(false)
    }
  })
})
