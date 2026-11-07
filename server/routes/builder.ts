import { Router } from 'express'
import { z } from 'zod'
import { getCustomer, requireAdmin, requireCustomer } from '../auth'
import { OrderError } from '../domain/pricing'
import { builderLimiter, creationSchema, parse } from '../http'
import { publishMenuChanged } from '../realtime'
import {
  approveCreation,
  deleteCreation,
  favouriteItemIds,
  listCommunity,
  listForModeration,
  listSaved,
  loadBuilderData,
  rejectCreation,
  saveCreation,
  setFavouriteItem,
  submitCreation,
  unpublishCreation,
} from '../services/builder'

export const builderRoutes = Router()

const idParam = (value: string | string[] | undefined): number => {
  const id = Number(Array.isArray(value) ? value[0] : value)
  if (!Number.isInteger(id) || id < 1) throw new OrderError('Not found.', 'not_found', 404)
  return id
}

/* ---------- Public ---------- */

// What the builder offers and what it costs. Read fresh, so a change in the dashboard shows up at once.
builderRoutes.get('/builder', (_req, res) => {
  res.set('Cache-Control', 'no-cache')
  res.json(loadBuilderData())
})

// Creations other students shared, after a person on the team approved them.
builderRoutes.get('/builder/community', (_req, res) => {
  res.set('Cache-Control', 'no-cache')
  res.json({ creations: listCommunity() })
})

/* ---------- Signed-in customers ---------- */

builderRoutes.get('/me/creations', requireCustomer, (_req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json({ creations: listSaved(getCustomer(res)!.id) })
})

const saveSchema = z.object({ name: z.string().max(80).default(''), config: creationSchema.omit({ name: true }) })

builderRoutes.post('/me/creations', requireCustomer, builderLimiter, (req, res) => {
  const { name, config } = parse(saveSchema, req.body)
  res.status(201).json({ creation: saveCreation(getCustomer(res)!.id, { name, config }) })
})

builderRoutes.delete('/me/creations/:id', requireCustomer, builderLimiter, (req, res) => {
  deleteCreation(getCustomer(res)!.id, idParam(req.params.id))
  publishMenuChanged()
  res.json({ ok: true })
})

builderRoutes.post('/me/creations/:id/submit', requireCustomer, builderLimiter, (req, res) => {
  res.json({ creation: submitCreation(getCustomer(res)!.id, idParam(req.params.id)) })
})

builderRoutes.get('/me/favourites', requireCustomer, (_req, res) => {
  res.set('Cache-Control', 'no-store')
  const userId = getCustomer(res)!.id
  res.json({ itemIds: favouriteItemIds(userId), creations: listSaved(userId) })
})

builderRoutes.put('/me/favourites/items/:id', requireCustomer, builderLimiter, (req, res) => {
  setFavouriteItem(getCustomer(res)!.id, idParam(req.params.id), true)
  res.json({ ok: true })
})

builderRoutes.delete('/me/favourites/items/:id', requireCustomer, builderLimiter, (req, res) => {
  setFavouriteItem(getCustomer(res)!.id, idParam(req.params.id), false)
  res.json({ ok: true })
})

/* ---------- Dashboard (admin) ---------- */

builderRoutes.get('/dashboard/creations', requireAdmin, (_req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json(listForModeration())
})

builderRoutes.post('/dashboard/creations/:id/approve', requireAdmin, (req, res) => {
  const { name } = parse(z.object({ name: z.string().max(80).optional() }), req.body)
  approveCreation(idParam(req.params.id), name)
  publishMenuChanged()
  res.json({ ok: true })
})

builderRoutes.post('/dashboard/creations/:id/reject', requireAdmin, (req, res) => {
  const { reason } = parse(z.object({ reason: z.string().min(1, 'Add a reason so they know why.').max(200) }), req.body)
  rejectCreation(idParam(req.params.id), reason)
  res.json({ ok: true })
})

builderRoutes.post('/dashboard/creations/:id/unpublish', requireAdmin, (req, res) => {
  unpublishCreation(idParam(req.params.id))
  publishMenuChanged()
  res.json({ ok: true })
})
