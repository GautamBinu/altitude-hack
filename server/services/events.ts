import { createHash, randomBytes } from 'node:crypto'
import { POST_LIMITS, type EventFeed, type EventPost, type ModerationPost, type ModerationQueue, type MySubmission, type PostKind, type PostStatus, type SubmitPostInput } from '../../shared/events'
import { countLinks } from '../../shared/markdown'
import { db } from '../db'
import { OrderError } from '../domain/pricing'
import { addDays, businessDate, getSettings, zonedTimeToUtc } from './settings'
import { assertLocalImage, saveImageDataUrl } from './uploads'

/** How many posts may wait for review at once: per signed-in person, per guest on one device, and in total. */
const MAX_PENDING_USER = 3
const MAX_PENDING_GUEST = 2
const MAX_PENDING_TOTAL = 60

/** An event still counts as upcoming for this long after it starts, so tonight's event stays on the feed tonight. */
const EVENT_GRACE_MS = 3 * 60 * 60 * 1000
/** A post with no date counts as recent for this long. */
const RECENT_POST_MS = 30 * 24 * 60 * 60 * 1000

interface PostRow {
  id: number
  kind: PostKind
  title: string
  club: string
  body: string
  starts_at: string | null
  place: string | null
  cover_image: string | null
  status: PostStatus
  reject_reason: string | null
  author_user_id: number | null
  author_name: string
  manage_token: string | null
  viewer_key: string | null
  is_sample: number
  created_at: string
  decided_at: string | null
  interest_count?: number
  interested?: number
}

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex')

/* ---------- Cleaning what people type ---------- */

const oneLine = (text: string, max: number): string => text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)

function cleanBody(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const bad = (message: string): never => {
  throw new OrderError(message, 'invalid_post', 400)
}

function parseDate(date: string | undefined, time: string | undefined): { date: string; time: string } | null {
  if (!date && !time) return null
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad('Pick the date of the event.')
  const [y, m, d] = date.split('-').map(Number)
  const real = new Date(Date.UTC(y, m - 1, d))
  if (real.getUTCFullYear() !== y || real.getUTCMonth() !== m - 1 || real.getUTCDate() !== d) return bad('That date does not exist.')
  if (!time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return bad('Pick the start time of the event.')
  return { date, time }
}

interface Content {
  kind: PostKind
  title: string
  club: string
  body: string
  startsAt: string | null
  place: string | null
}

/** Checks and tidies what a person wrote. `strictDate` turns away events in the past, for new submissions. */
function validateContent(input: Pick<SubmitPostInput, 'kind' | 'title' | 'club' | 'body' | 'date' | 'time' | 'place'>, strictDate: boolean): Content {
  if (input.kind !== 'event' && input.kind !== 'post') bad('Choose event or post.')
  const title = oneLine(input.title ?? '', POST_LIMITS.title)
  if (title.length < 3) bad('Give it a title of at least 3 letters.')
  const club = oneLine(input.club ?? '', POST_LIMITS.club)
  if (club.length < 2) bad('Say which club or community this is from.')
  const body = cleanBody(input.body ?? '')
  if (body.length < 10) bad('Add a few words about it. At least 10 characters.')
  if (body.length > POST_LIMITS.body) bad(`Keep the text under ${POST_LIMITS.body.toLocaleString('en-US')} characters.`)
  if (countLinks(body) > POST_LIMITS.links) bad(`Use at most ${POST_LIMITS.links} links.`)

  let startsAt: string | null = null
  let place: string | null = null
  if (input.kind === 'event') {
    const when = parseDate(input.date, input.time)
    if (!when) bad('Pick the date and start time of the event.')
    const timezone = getSettings().timezone
    const instant = zonedTimeToUtc(when!.date, when!.time, timezone)
    if (strictDate) {
      const today = businessDate(new Date(), timezone)
      if (when!.date < today) bad('That date has already passed.')
      if (when!.date > addDays(today, 365)) bad('Pick a date within the next year.')
    }
    startsAt = instant.toISOString()
    place = oneLine(input.place ?? '', POST_LIMITS.place) || null
  }
  return { kind: input.kind, title, club, body, startsAt, place }
}

/* ---------- Reading ---------- */

function toPost(row: PostRow): EventPost {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    club: row.club,
    body: row.body,
    startsAt: row.starts_at,
    place: row.place,
    coverImage: row.cover_image,
    interestCount: row.interest_count ?? 0,
    interested: (row.interested ?? 0) === 1,
    isSample: row.is_sample === 1,
    createdAt: row.created_at,
  }
}

const SELECT_PUBLIC = `SELECT p.*, (SELECT COUNT(*) FROM post_interest i WHERE i.post_id = p.id) AS interest_count,
  CASE WHEN @viewer IS NOT NULL AND EXISTS (SELECT 1 FROM post_interest i WHERE i.post_id = p.id AND i.viewer_key = @viewer) THEN 1 ELSE 0 END AS interested
  FROM posts p`

export function listFeed(when: 'upcoming' | 'past' | 'all', club: string | null, viewer: string | null, nowMs = Date.now()): EventFeed {
  const rows = db.prepare(`${SELECT_PUBLIC} WHERE p.status = 'approved'`).all({ viewer }) as PostRow[]
  const upcomingCut = new Date(nowMs - EVENT_GRACE_MS).toISOString()
  const recentCut = new Date(nowMs - RECENT_POST_MS).toISOString()
  const isUpcoming = (r: PostRow) => (r.starts_at ? r.starts_at >= upcomingCut : r.created_at >= recentCut)

  const clubs = [...new Set(rows.map((r) => r.club))].sort((a, b) => a.localeCompare(b))
  let picked = rows.filter((r) => (when === 'all' ? true : when === 'upcoming' ? isUpcoming(r) : !isUpcoming(r)))
  if (club) picked = picked.filter((r) => r.club === club)

  const byDate = (a: PostRow, b: PostRow) => (a.starts_at ?? a.created_at).localeCompare(b.starts_at ?? b.created_at)
  if (when === 'upcoming') {
    // Dated events soonest first, then the posts without a date, newest first.
    picked.sort((a, b) => Number(!a.starts_at) - Number(!b.starts_at) || (a.starts_at && b.starts_at ? byDate(a, b) : -byDate(a, b)))
  } else {
    picked.sort((a, b) => -byDate(a, b))
  }
  return { posts: picked.map(toPost), clubs }
}

export function getPublicPost(id: number, viewer: string | null): EventPost | null {
  const row = db.prepare(`${SELECT_PUBLIC} WHERE p.id = @id AND p.status = 'approved'`).get({ id, viewer }) as PostRow | undefined
  return row ? toPost(row) : null
}

/** Records or removes one person's "I'm interested". Each person counts once. */
export function setInterest(id: number, viewer: string, on: boolean): { interested: boolean; interestCount: number } {
  const post = db.prepare(`SELECT id FROM posts WHERE id = ? AND status = 'approved'`).get(id)
  if (!post) throw new OrderError("We couldn't find that post.", 'not_found', 404)
  if (on) db.prepare('INSERT OR IGNORE INTO post_interest (post_id, viewer_key, created_at) VALUES (?, ?, ?)').run(id, viewer, new Date().toISOString())
  else db.prepare('DELETE FROM post_interest WHERE post_id = ? AND viewer_key = ?').run(id, viewer)
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM post_interest WHERE post_id = ?').get(id) as { n: number }
  return { interested: on, interestCount: n }
}

/* ---------- Submitting ---------- */

const toSubmission = (row: PostRow): MySubmission => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  club: row.club,
  status: row.status,
  rejectReason: row.reject_reason,
  startsAt: row.starts_at,
  createdAt: row.created_at,
})

export interface Submitter {
  userId: number | null
  firstName: string | null
  viewer: string
}

/**
 * Saves a post as pending. Nothing is public until a person on the team approves it. Signed-in people post
 * under their own name; guests give one. The picture, if there is one, is checked and saved here.
 */
export function submitPost(input: SubmitPostInput, who: Submitter): { post: MySubmission; token: string } {
  const content = validateContent(input, true)
  const authorName = who.userId != null ? (who.firstName ?? 'A student') : oneLine(input.authorName ?? '', POST_LIMITS.name)
  if (who.userId == null && authorName.length < 2) bad('Tell us your name so the team knows who sent it.')

  const pendingTotal = (db.prepare(`SELECT COUNT(*) AS n FROM posts WHERE status = 'pending'`).get() as { n: number }).n
  if (pendingTotal >= MAX_PENDING_TOTAL) {
    throw new OrderError('There are a lot of posts waiting for review right now. Try again later.', 'queue_full', 429)
  }
  const pendingMine = (db.prepare(`SELECT COUNT(*) AS n FROM posts WHERE status = 'pending' AND viewer_key = ?`).get(who.viewer) as { n: number }).n
  const cap = who.userId != null ? MAX_PENDING_USER : MAX_PENDING_GUEST
  if (pendingMine >= cap) {
    throw new OrderError(`You already have ${pendingMine} ${pendingMine === 1 ? 'post' : 'posts'} waiting for review. Wait for those first.`, 'too_many_pending', 429)
  }

  const cover = input.coverImage ? saveImageDataUrl(input.coverImage, 'events') : null
  const token = randomBytes(18).toString('base64url')
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO posts (kind, title, club, body, starts_at, place, cover_image, status, author_user_id, author_name, manage_token, viewer_key, is_sample, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, 0, ?)`,
    )
    .run(content.kind, content.title, content.club, content.body, content.startsAt, content.place, cover, who.userId, authorName, hashToken(token), who.viewer, new Date().toISOString())
  const row = db.prepare('SELECT * FROM posts WHERE id = ?').get(Number(lastInsertRowid)) as PostRow
  return { post: toSubmission(row), token }
}

/** A person's own posts, found by who they are (signed in) or by the private tokens kept on their device. */
export function mySubmissions(userId: number | null, tokens: string[]): MySubmission[] {
  const rows: PostRow[] = []
  if (userId != null) rows.push(...(db.prepare('SELECT * FROM posts WHERE author_user_id = ? ORDER BY id DESC LIMIT 30').all(userId) as PostRow[]))
  const hashes = [...new Set(tokens.filter((t) => /^[A-Za-z0-9_-]{16,64}$/.test(t)).slice(0, 20).map(hashToken))]
  if (hashes.length > 0) {
    const marks = hashes.map(() => '?').join(',')
    rows.push(...(db.prepare(`SELECT * FROM posts WHERE manage_token IN (${marks}) ORDER BY id DESC`).all(...hashes) as PostRow[]))
  }
  const seen = new Set<number>()
  return rows.filter((r) => !seen.has(r.id) && seen.add(r.id)).sort((a, b) => b.id - a.id).map(toSubmission)
}

/** The author can take back a post that is still waiting, or one that was turned down. */
export function withdrawPost(id: number, who: { userId: number | null; token: string | null }): void {
  const row = db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as PostRow | undefined
  const ownsByUser = !!row && who.userId != null && row.author_user_id === who.userId
  const ownsByToken = !!row && !!who.token && row.manage_token === hashToken(who.token)
  if (!row || (!ownsByUser && !ownsByToken)) throw new OrderError("We couldn't find that post.", 'not_found', 404)
  if (row.status !== 'pending' && row.status !== 'rejected') {
    throw new OrderError('That post is already public. Ask the team to take it down.', 'wrong_state', 409)
  }
  db.prepare('DELETE FROM post_interest WHERE post_id = ?').run(id)
  db.prepare('DELETE FROM posts WHERE id = ?').run(id)
}

/* ---------- Moderation ---------- */

const shopTime = (iso: string | null, timezone: string): { date: string | null; time: string | null } => {
  if (!iso) return { date: null, time: null }
  const date = new Date(iso)
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)
  return { date: businessDate(date, timezone), time }
}

function toModeration(row: PostRow, timezone: string): ModerationPost {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    club: row.club,
    body: row.body,
    startsAt: row.starts_at,
    ...shopTime(row.starts_at, timezone),
    place: row.place,
    coverImage: row.cover_image,
    status: row.status,
    rejectReason: row.reject_reason,
    authorName: row.author_name,
    signedIn: row.author_user_id != null,
    isSample: row.is_sample === 1,
    interestCount: row.interest_count ?? 0,
    createdAt: row.created_at,
    decidedAt: row.decided_at,
  }
}

export function listModeration(): ModerationQueue {
  const timezone = getSettings().timezone
  const rows = db
    .prepare(`SELECT p.*, (SELECT COUNT(*) FROM post_interest i WHERE i.post_id = p.id) AS interest_count FROM posts p ORDER BY p.id DESC`)
    .all() as PostRow[]
  const all = rows.map((r) => toModeration(r, timezone))
  return {
    // Oldest first, so the queue is worked in the order it arrived.
    pending: all.filter((p) => p.status === 'pending').reverse(),
    decided: all.filter((p) => p.status !== 'pending').slice(0, 40),
  }
}

function getRow(id: number): PostRow {
  const row = db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as PostRow | undefined
  if (!row) throw new OrderError('Post not found.', 'not_found', 404)
  return row
}

export interface PostEdit {
  title: string
  club: string
  body: string
  date?: string
  time?: string
  place?: string
  /** An address already on this server, or null to remove the picture. */
  coverImage?: string | null
}

/** The team can fix wording, the date or the picture before approving, or after. */
export function editPost(id: number, edit: PostEdit): void {
  const row = getRow(id)
  const content = validateContent({ kind: row.kind, ...edit }, false)
  const cover = edit.coverImage === undefined ? row.cover_image : assertLocalImage(edit.coverImage)
  db.prepare('UPDATE posts SET title = ?, club = ?, body = ?, starts_at = ?, place = ?, cover_image = ? WHERE id = ?').run(
    content.title, content.club, content.body, content.startsAt, content.place, cover, id,
  )
}

export function approvePost(id: number): void {
  const row = getRow(id)
  if (row.status !== 'pending') throw new OrderError('Only a post that is waiting for review can be approved.', 'wrong_state', 409)
  db.prepare(`UPDATE posts SET status = 'approved', reject_reason = NULL, decided_at = ? WHERE id = ?`).run(new Date().toISOString(), id)
}

/** The reason is shown to the person who sent it. */
export function rejectPost(id: number, reason: string): void {
  const row = getRow(id)
  if (row.status !== 'pending') throw new OrderError('Only a post that is waiting for review can be turned down.', 'wrong_state', 409)
  const text = oneLine(reason, 160)
  if (!text) throw new OrderError('Add a reason so they know why.', 'invalid_request')
  db.prepare(`UPDATE posts SET status = 'rejected', reject_reason = ?, decided_at = ? WHERE id = ?`).run(text, new Date().toISOString(), id)
}

export function unpublishPost(id: number): void {
  const row = getRow(id)
  if (row.status !== 'approved') throw new OrderError('That post is not public.', 'wrong_state', 409)
  db.prepare(`UPDATE posts SET status = 'unpublished', decided_at = ? WHERE id = ?`).run(new Date().toISOString(), id)
}

export function republishPost(id: number): void {
  const row = getRow(id)
  if (row.status !== 'unpublished') throw new OrderError('That post was not taken down.', 'wrong_state', 409)
  db.prepare(`UPDATE posts SET status = 'approved', decided_at = ? WHERE id = ?`).run(new Date().toISOString(), id)
}
