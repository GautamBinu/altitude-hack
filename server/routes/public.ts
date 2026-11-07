import { Router } from 'express'
import type { AppConfig, MenuResponse } from '../../shared/types'
import { config } from '../config'
import { addPublicStream } from '../realtime'
import { loadMenu } from '../services/menu'
import { getQueueStatus } from '../services/views'

export const publicRoutes = Router()

publicRoutes.get('/health', (_req, res) => {
  res.json({ ok: true })
})

publicRoutes.get('/config', (_req, res) => {
  const body: AppConfig = { demoMode: config.demoMode, googleClientId: config.googleClientId, vapidPublicKey: null }
  res.json(body)
})

// Guests can browse the menu. Prices are read fresh, so a change in the database shows up at once.
publicRoutes.get('/menu', (_req, res) => {
  const body: MenuResponse = { categories: loadMenu() }
  res.set('Cache-Control', 'no-cache')
  res.json(body)
})

// Tells every open app when the menu or promotions change, so edits in the dashboard show up at once.
publicRoutes.get('/stream/public', (req, res) => {
  addPublicStream(req, res)
})

publicRoutes.get('/queue-status', (_req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json(getQueueStatus())
})
