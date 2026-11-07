import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import cookieParser from 'cookie-parser'
import express from 'express'
import { purgeExpiredSessions } from './auth'
import { config } from './config'
import { errorHandler, originGuard } from './http'
import { authRoutes } from './routes/auth'
import { dashboardRoutes } from './routes/dashboard'
import { meRoutes } from './routes/me'
import { orderRoutes } from './routes/orders'
import { publicRoutes } from './routes/public'
import { ensureSeeded } from './seed'

const seeded = ensureSeeded()
if (seeded) console.log('[server] first start: database created and seeded with the menu.')
purgeExpiredSessions()
setInterval(purgeExpiredSessions, 60 * 60 * 1000).unref()

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
app.use(express.json({ limit: '32kb' }))
app.use(cookieParser())

app.use('/api', originGuard, publicRoutes, authRoutes, meRoutes, orderRoutes, dashboardRoutes)
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
