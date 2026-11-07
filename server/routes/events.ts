import { randomBytes } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { findCustomer, requireAdmin, requireCustomer, getCustomer } from '../auth'
import { OrderError } from '../domain/pricing'
import { eventLimiter, interestLimiter, parse } from '../http'
import { publishMenuChanged } from '../realtime'
import {
  approvePost,
  editPost,
  getPublicPost,
  listFeed,
  listModeration,
  mySubmissions,
  rejectPost,
  republishPost,
  setInterest,
  submitPost,
  unpublishPost,
  withdrawPost,
} from '../services/events'
import { viewerKey } from '../viewer'

export const eventRoutes = Router()

const idParam = (value: string | string[] | undefined): number => {
  const id = Number(Array.isArray(value) ? value[0] : value)
  if (!Number.isInteger(id) || id < 1) throw new OrderError("We couldn't find that post.", 'not_found', 404)
  return id
}

/* ---------- Public ---------- */

eventRoutes.get('/events', (req, res) => {
  const { when, club } = parse(
    z.object({ when: z.enum(['upcoming', 'past', 'all']).default('upcoming'), club: z.string().max(80).optional() }),
    req.query,
  )
  res.set('Cache-Control', 'no-store')
  res.json(listFeed(when, club?.trim() || null, viewerKey(req, res, { create: false })))
})

eventRoutes.get('/events/:id', (req, res) => {
  const post = getPublicPost(idParam(req.params.id), viewerKey(req, res, { create: false }))
  if (!post) throw new OrderError("We couldn't find that post. It may not be public yet.", 'not_found', 404)
  res.set('Cache-Control', 'no-store')
  res.json({ post })
})

// "I'm interested". One per person; a guest is told apart by a cookie that holds no personal data.
eventRoutes.post('/events/:id/interest', interestLimiter, (req, res) => {
  const { on } = parse(z.object({ on: z.boolean() }), req.body)
  const viewer = viewerKey(req, res, { create: true })!
  res.json(setInterest(idParam(req.params.id), viewer, on))
})

const submitSchema = z.object({
  kind: z.enum(['event', 'post']),
  title: z.string().max(300),
  club: z.string().max(300),
  body: z.string().max(9000),
  date: z.string().max(10).optional(),
  time: z.string().max(5).optional(),
  place: z.string().max(300).optional(),
  coverImage: z.string().max(1_800_000).nullable().optional(),
  authorName: z.string().max(200).optional(),
  website: z.string().max(300).optional(),
})

// Anyone can send a post, signed in or not. It waits for a person on the team before anyone else sees it.
eventRoutes.post('/events', eventLimiter, (req, res) => {
  const input = parse(submitSchema, req.body)
  // A real person never fills the hidden "website" field. Say thanks and keep nothing.
  if (input.website?.trim()) {
    res.status(201).json({
      post: { id: 0, kind: input.kind, title: input.title.slice(0, 80), club: input.club.slice(0, 60), status: 'pending', rejectReason: null, startsAt: null, createdAt: new Date().toISOString() },
      token: randomBytes(18).toString('base64url'),
    })
    return
  }
  const customer = findCustomer(req)
  const viewer = viewerKey(req, res, { create: true })!
  const result = submitPost(input, { userId: customer?.id ?? null, firstName: customer?.firstName ?? null, viewer })
  res.status(201).json(result)
})

// A signed-in person's own posts.
eventRoutes.get('/me/posts', requireCustomer, (_req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json({ posts: mySubmissions(getCustomer(res)!.id, []) })
})

// A guest's posts, found by the private tokens kept on their device.
eventRoutes.post('/events/status', interestLimiter, (req, res) => {
  const { tokens } = parse(z.object({ tokens: z.array(z.string().max(80)).max(20) }), req.body)
  res.set('Cache-Control', 'no-store')
  res.json({ posts: mySubmissions(findCustomer(req)?.id ?? null, tokens) })
})

eventRoutes.post('/events/:id/withdraw', interestLimiter, (req, res) => {
  const { token } = parse(z.object({ token: z.string().max(80).optional() }), req.body)
  withdrawPost(idParam(req.params.id), { userId: findCustomer(req)?.id ?? null, token: token ?? null })
  publishMenuChanged()
  res.json({ ok: true })
})

/* ---------- Dashboard (admin) ---------- */

eventRoutes.get('/dashboard/posts', requireAdmin, (_req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json(listModeration())
})

const editSchema = z.object({
  title: z.string().max(300),
  club: z.string().max(300),
  body: z.string().max(9000),
  date: z.string().max(10).optional(),
  time: z.string().max(5).optional(),
  place: z.string().max(300).optional(),
  coverImage: z.string().max(200).nullable().optional(),
})

eventRoutes.patch('/dashboard/posts/:id', requireAdmin, (req, res) => {
  editPost(idParam(req.params.id), parse(editSchema, req.body))
  publishMenuChanged()
  res.json({ ok: true })
})

eventRoutes.post('/dashboard/posts/:id/approve', requireAdmin, (req, res) => {
  approvePost(idParam(req.params.id))
  publishMenuChanged()
  res.json({ ok: true })
})

eventRoutes.post('/dashboard/posts/:id/reject', requireAdmin, (req, res) => {
  const { reason } = parse(z.object({ reason: z.string().min(1, 'Add a reason so they know why.').max(200) }), req.body)
  rejectPost(idParam(req.params.id), reason)
  res.json({ ok: true })
})

eventRoutes.post('/dashboard/posts/:id/unpublish', requireAdmin, (req, res) => {
  unpublishPost(idParam(req.params.id))
  publishMenuChanged()
  res.json({ ok: true })
})

eventRoutes.post('/dashboard/posts/:id/publish', requireAdmin, (req, res) => {
  republishPost(idParam(req.params.id))
  publishMenuChanged()
  res.json({ ok: true })
})
