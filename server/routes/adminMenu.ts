import { Router } from 'express'
import { z } from 'zod'
import { requireAdmin, requireStaff } from '../auth'
import { parse } from '../http'
import {
  createBuilderOption,
  createCategory,
  createGroup,
  createItem,
  deleteBuilderOption,
  deleteCategory,
  deleteGroup,
  deleteItem,
  getAdminMenu,
  moveCategory,
  moveItem,
  renameCategory,
  setSummitBox,
  updateBuilderOption,
  updateGroup,
  updateItem,
} from '../services/adminMenu'
import {
  createBanner,
  createCode,
  deleteBanner,
  deleteCode,
  getAdminPromotions,
  setPromoDrink,
  updateBanner,
  updateCode,
} from '../services/promotions'
import { saveImageDataUrl } from '../services/uploads'

/** Menu manager and promotions. Reading needs any staff login; changing needs an admin, except marking something sold out. */
export const adminMenuRoutes = Router()

const id = z.coerce.number().int().positive()
const idParam = (value: unknown) => parse(id, value)
const temperature = z.enum(['hot', 'iced', 'both', 'none'])
const fils = z.number().int().min(0).max(1_000_000)
const dateText = z.string().max(40).nullable()

adminMenuRoutes.post('/dashboard/uploads', requireAdmin, (req, res) => {
  const body = parse(z.object({ dataUrl: z.string().max(1_800_000), folder: z.enum(['menu', 'promo']) }), req.body)
  res.status(201).json({ url: saveImageDataUrl(body.dataUrl, body.folder) })
})

/* ---------- Menu ---------- */

adminMenuRoutes.get('/dashboard/menu', requireStaff, (_req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json(getAdminMenu())
})

const categoryBody = z.object({ name: z.string().max(80) })
adminMenuRoutes.post('/dashboard/categories', requireAdmin, (req, res) => {
  res.status(201).json({ id: createCategory(parse(categoryBody, req.body).name) })
})
adminMenuRoutes.patch('/dashboard/categories/:id', requireAdmin, (req, res) => {
  renameCategory(idParam(req.params.id), parse(categoryBody, req.body).name)
  res.json({ ok: true })
})
adminMenuRoutes.post('/dashboard/categories/:id/move', requireAdmin, (req, res) => {
  moveCategory(idParam(req.params.id), parse(z.object({ direction: z.enum(['up', 'down']) }), req.body).direction)
  res.json({ ok: true })
})
adminMenuRoutes.delete('/dashboard/categories/:id', requireAdmin, (req, res) => {
  deleteCategory(idParam(req.params.id))
  res.json({ ok: true })
})

// No defaults here. A partial update must change only what it names: a default would quietly reset
// the description, tags or choices of an item whenever someone edited only its price.
const itemFields = z.object({
  categoryId: z.number().int().positive(),
  name: z.string().max(80),
  description: z.string().max(400),
  priceFils: fils,
  priceUnconfirmed: z.boolean(),
  temperature,
  caffeineFree: z.boolean(),
  prepSeconds: z.number().int().min(5).max(3600),
  kind: z.enum(['drink', 'food']),
  tags: z.array(z.string().max(40)).max(20),
  image: z.string().max(200).nullable(),
  soldOut: z.boolean(),
  hidden: z.boolean(),
  groupIds: z.array(z.number().int().positive()).max(20),
})

const itemCreate = itemFields
  .pick({ categoryId: true, name: true, priceFils: true, temperature: true, caffeineFree: true, prepSeconds: true, kind: true })
  .extend({
    description: itemFields.shape.description.default(''),
    tags: itemFields.shape.tags.default([]),
    groupIds: itemFields.shape.groupIds.default([]),
    priceUnconfirmed: itemFields.shape.priceUnconfirmed.optional(),
    image: itemFields.shape.image.optional(),
    soldOut: itemFields.shape.soldOut.optional(),
    hidden: itemFields.shape.hidden.optional(),
  })

adminMenuRoutes.post('/dashboard/items', requireAdmin, (req, res) => {
  res.status(201).json({ id: createItem(parse(itemCreate, req.body)) })
})
adminMenuRoutes.patch('/dashboard/items/:id', requireAdmin, (req, res) => {
  updateItem(idParam(req.params.id), parse(itemFields.partial(), req.body))
  res.json({ ok: true })
})
// The counter can mark things sold out without being an admin.
adminMenuRoutes.post('/dashboard/items/:id/availability', requireStaff, (req, res) => {
  updateItem(idParam(req.params.id), { soldOut: parse(z.object({ soldOut: z.boolean() }), req.body).soldOut })
  res.json({ ok: true })
})
adminMenuRoutes.post('/dashboard/items/:id/move', requireAdmin, (req, res) => {
  moveItem(idParam(req.params.id), parse(z.object({ direction: z.enum(['up', 'down']) }), req.body).direction)
  res.json({ ok: true })
})
adminMenuRoutes.delete('/dashboard/items/:id', requireAdmin, (req, res) => {
  deleteItem(idParam(req.params.id))
  res.json({ ok: true })
})

/* ---------- Choices ---------- */

const groupBody = z.object({
  name: z.string().max(80),
  kind: z.enum(['single', 'multi']),
  required: z.boolean(),
  showDefault: z.boolean(),
  inlineLabel: z.boolean(),
  options: z
    .array(
      z.object({
        id: z.number().int().positive().optional(),
        name: z.string().max(80),
        priceDeltaFils: fils,
        isDefault: z.boolean(),
        unconfirmed: z.boolean().optional(),
      }),
    )
    .max(40),
})
adminMenuRoutes.post('/dashboard/groups', requireAdmin, (req, res) => {
  res.status(201).json({ id: createGroup(parse(groupBody, req.body)) })
})
adminMenuRoutes.put('/dashboard/groups/:id', requireAdmin, (req, res) => {
  updateGroup(idParam(req.params.id), parse(groupBody, req.body))
  res.json({ ok: true })
})
adminMenuRoutes.delete('/dashboard/groups/:id', requireAdmin, (req, res) => {
  deleteGroup(idParam(req.params.id))
  res.json({ ok: true })
})

/* ---------- Builder and Summit Box ---------- */

const builderBody = z.object({
  kind: z.enum(['base', 'flavour', 'shot', 'topping', 'sweetness']),
  name: z.string().max(80),
  priceFils: fils,
  color: z.string().max(7).nullable().optional(),
  temperature: z.enum(['hot', 'iced', 'both']).optional(),
  usesMilk: z.boolean().optional(),
  prepSeconds: z.number().int().min(0).max(900).optional(),
  available: z.boolean().optional(),
  unconfirmed: z.boolean().optional(),
})
adminMenuRoutes.post('/dashboard/builder', requireAdmin, (req, res) => {
  res.status(201).json({ id: createBuilderOption(parse(builderBody, req.body)) })
})
adminMenuRoutes.patch('/dashboard/builder/:id', requireAdmin, (req, res) => {
  updateBuilderOption(idParam(req.params.id), parse(builderBody.omit({ kind: true }).partial(), req.body))
  res.json({ ok: true })
})
adminMenuRoutes.delete('/dashboard/builder/:id', requireAdmin, (req, res) => {
  deleteBuilderOption(idParam(req.params.id))
  res.json({ ok: true })
})

adminMenuRoutes.put('/dashboard/summit-box', requireAdmin, (req, res) => {
  const body = parse(
    z.object({ prices: z.array(z.object({ size: z.number().int().min(2).max(100), priceFils: z.number().int().min(0).max(1_000_000) })).max(4) }),
    req.body,
  )
  setSummitBox(body.prices)
  res.json({ ok: true })
})

/* ---------- Promotions ---------- */

adminMenuRoutes.get('/dashboard/promotions', requireAdmin, (_req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json(getAdminPromotions())
})

adminMenuRoutes.put('/dashboard/promo-drink', requireAdmin, (req, res) => {
  const body = parse(
    z.object({
      itemId: z.number().int().positive().nullable(),
      headline: z.string().max(120),
      copy: z.string().max(300),
      imageUrl: z.string().max(200).nullable(),
      endsAt: dateText,
      active: z.boolean(),
    }),
    req.body,
  )
  setPromoDrink(body)
  res.json({ ok: true })
})

const bannerBody = z.object({
  title: z.string().max(120),
  body: z.string().max(300),
  imageUrl: z.string().max(200).nullable(),
  itemId: z.number().int().positive().nullable(),
  active: z.boolean(),
  startsAt: dateText,
  endsAt: dateText,
})
adminMenuRoutes.post('/dashboard/banners', requireAdmin, (req, res) => {
  res.status(201).json({ id: createBanner(parse(bannerBody, req.body)) })
})
adminMenuRoutes.put('/dashboard/banners/:id', requireAdmin, (req, res) => {
  updateBanner(idParam(req.params.id), parse(bannerBody, req.body))
  res.json({ ok: true })
})
adminMenuRoutes.delete('/dashboard/banners/:id', requireAdmin, (req, res) => {
  deleteBanner(idParam(req.params.id))
  res.json({ ok: true })
})

const codeBody = z.object({
  code: z.string().max(40),
  kind: z.enum(['percent', 'fixed']),
  value: z.number().int().min(1).max(1_000_000),
  startsAt: dateText,
  endsAt: dateText,
  active: z.boolean(),
  maxUses: z.number().int().min(1).max(100000).nullable(),
})
adminMenuRoutes.post('/dashboard/codes', requireAdmin, (req, res) => {
  res.status(201).json({ id: createCode(parse(codeBody, req.body)) })
})
adminMenuRoutes.put('/dashboard/codes/:id', requireAdmin, (req, res) => {
  updateCode(idParam(req.params.id), parse(codeBody, req.body))
  res.json({ ok: true })
})
adminMenuRoutes.delete('/dashboard/codes/:id', requireAdmin, (req, res) => {
  deleteCode(idParam(req.params.id))
  res.json({ ok: true })
})
