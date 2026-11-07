import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import cookieParser from 'cookie-parser'
import express from 'express'
import { purgeExpiredSessions } from './auth'
import { config } from './config'
import { errorHandler, originGuard } from './http'
import { adminMenuRoutes } from './routes/adminMenu'
import { authRoutes } from './routes/auth'
import { builderRoutes } from './routes/builder'
import { dashboardRoutes } from './routes/dashboard'
import { eventRoutes } from './routes/events'
import { statsRoutes } from './routes/stats'
import { homeRoutes } from './routes/home'
import { meRoutes } from './routes/me'
import { moodRoutes } from './routes/mood'
import { orderRoutes } from './routes/orders'
import { publicRoutes } from './routes/public'
import { ensureSeeded } from './seed'
import { releaseDueOrders } from './services/orders'

const seeded = ensureSeeded()
if (seeded) console.log('[server] first start: database created and seeded with the menu.')
purgeExpiredSessions()
setInterval(purgeExpiredSessions, 60 * 60 * 1000).unref()

// Pre-orders wait on the Scheduled lane and join the live queue when it is time to start them.
releaseDueOrders()
setInterval(() => {
  try {
    releaseDueOrders()
  } catch (error) {
    console.error('[schedule] could not release due orders', error)
  }
}, 5000).unref()

const app = express()
app.disable('x-powered-by')
// Behind Render, Railway or Fly there is one proxy in front of us. Needed for secure cookies and rate limits.
if (config.isProduction) app.set('trust proxy', 1)

app.use((_req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
  })
  next()
})
// Almost everything is small JSON. Pictures arrive as data URLs on two routes, which get a bigger limit.
const smallJson = express.json({ limit: '32kb' })
const largeJson = express.json({ limit: '2mb' })
const LARGE_BODY = /^\/api\/(dashboard\/uploads|events)$/
app.use((req, res, next) => (LARGE_BODY.test(req.path) ? largeJson : smallJson)(req, res, next))
app.use(cookieParser())

// Pictures uploaded from the dashboard and by event organisers. Names are random, so they can be cached for good.
app.use('/uploads', express.static(config.uploadDir, { maxAge: '30d', immutable: true, index: false, fallthrough: true }))

app.use('/api', originGuard, publicRoutes, authRoutes, homeRoutes, moodRoutes, builderRoutes, eventRoutes, statsRoutes, meRoutes, orderRoutes, dashboardRoutes, adminMenuRoutes)
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found.', code: 'not_found' })
})

// In production the built web app is served by this same server.
const dist = resolve('dist')
if (existsSync(resolve(dist, 'index.html'))) {
  app.use(express.static(dist, { index: false, maxAge: '1h' }))
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    res.sendFile(resolve(dist, 'index.html'))
  })
}

app.use(errorHandler)

app.listen(config.port, '0.0.0.0', () => {
  console.log(`[server] API listening on http://localhost:${config.port}`)
  console.log(`[server] demo sign-in: ${config.demoMode ? 'on' : 'off'}, google sign-in: ${config.googleClientId ? 'configured' : 'not configured'}`)
  if (!existsSync(resolve(dist, 'index.html'))) {
    console.log('[server] no build found. In development open the web app at http://localhost:5173')
  }
})
