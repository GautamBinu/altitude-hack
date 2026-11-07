import { Router } from 'express'
import { OAuth2Client } from 'google-auth-library'
import { getCustomer, attachCustomer, signInCustomer, signOutCustomer } from '../auth'
import { config } from '../config'
import { OrderError } from '../domain/pricing'
import { authLimiter, googleSignInSchema, parse } from '../http'

export const authRoutes = Router()

const googleClient = config.googleClientId ? new OAuth2Client(config.googleClientId) : null

authRoutes.get('/auth/me', attachCustomer, (_req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json({ user: getCustomer(res) })
})

// Google Identity Services gives the browser an ID token. We verify it here, with Google's
// public keys, and check it was issued for our client id. We never trust the browser's word.
authRoutes.post('/auth/google', authLimiter, async (req, res) => {
  if (!googleClient || !config.googleClientId) {
    throw new OrderError("Google sign-in isn't set up on this server.", 'google_not_configured', 503)
  }
  const { credential } = parse(googleSignInSchema, req.body)

  let payload
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: config.googleClientId })
    payload = ticket.getPayload()
  } catch {
    throw new OrderError("We couldn't verify that Google sign-in. Try again.", 'invalid_token', 401)
  }
  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    throw new OrderError('Use a Google account with a verified email.', 'unverified_email', 401)
  }

  if (config.allowedEmailDomains.length > 0) {
    const domain = payload.email.split('@')[1]?.toLowerCase() ?? ''
    if (!config.allowedEmailDomains.includes(domain)) {
      throw new OrderError(
        `Sign in with your university account (${config.allowedEmailDomains.map((d) => `@${d}`).join(', ')}).`,
        'domain_not_allowed',
        403,
      )
    }
  }

  const name = payload.name?.trim() || payload.email.split('@')[0]
  const firstName = payload.given_name?.trim() || name.split(/\s+/)[0]
  const user = signInCustomer(res, {
    sub: `google:${payload.sub}`,
    email: payload.email,
    name,
    firstName,
    pictureUrl: payload.picture ?? null,
    isDemo: false,
  })
  res.json({ user })
})

// Demo sign-in exists so the app can be shown without Google credentials. It is off unless DEMO_MODE=true.
authRoutes.post('/auth/demo', authLimiter, (_req, res) => {
  if (!config.demoMode) {
    throw new OrderError('Demo sign-in is turned off on this server.', 'demo_disabled', 403)
  }
  const user = signInCustomer(res, {
    sub: 'demo:student',
    email: null,
    name: 'Aisha (demo student)',
    firstName: 'Aisha',
    pictureUrl: null,
    isDemo: true,
  })
  res.json({ user })
})

authRoutes.post('/auth/logout', (req, res) => {
  signOutCustomer(req, res)
  res.json({ ok: true })
})
