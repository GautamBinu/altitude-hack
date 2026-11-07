export type PostKind = 'event' | 'post'
export type PostStatus = 'pending' | 'approved' | 'rejected' | 'unpublished'

/** The most each part of a post may hold. Enforced on the server; the form shows them too. */
export const POST_LIMITS = { title: 80, club: 60, body: 4000, place: 80, name: 40, links: 5 } as const

/** A post on the public feed. */
export interface EventPost {
  id: number
  kind: PostKind
  title: string
  /** The club or community behind it. */
  club: string
  /** Markdown. Draw it with the safe renderer, never as HTML. */
  body: string
  startsAt: string | null
  place: string | null
  coverImage: string | null
  interestCount: number
  /** Whether the person looking has tapped "I'm interested". */
  interested: boolean
  isSample: boolean
  createdAt: string
}

export interface EventFeed {
  posts: EventPost[]
  /** Every club with a post on the feed, for the filter. */
  clubs: string[]
}

/** What a submitter sees about their own post. */
export interface MySubmission {
  id: number
  kind: PostKind
  title: string
  club: string
  status: PostStatus
  rejectReason: string | null
  startsAt: string | null
  createdAt: string
}

export interface SubmitPostInput {
  kind: PostKind
  title: string
  club: string
  body: string
  /** Events only. The date and time on the shop's clock, as typed: 2026-11-12 and 18:30. */
  date?: string
  time?: string
  place?: string
  /** A picture as a data URL, already shrunk by the browser. */
  coverImage?: string | null
  /** Guests give a name; signed-in people are posted under their own. */
  authorName?: string
  /** A hidden field real people leave empty. Anything in it means a script filled the form. */
  website?: string
}

export interface SubmitPostResult {
  post: MySubmission
  /** Lets a guest check on this post from this device. Keep it private. */
  token: string
}

/** A post as the team reviews it. */
export interface ModerationPost {
  id: number
  kind: PostKind
  title: string
  club: string
  body: string
  startsAt: string | null
  /** The date and time on the shop's clock, for the edit form. */
  date: string | null
  time: string | null
  place: string | null
  coverImage: string | null
  status: PostStatus
  rejectReason: string | null
  authorName: string
  signedIn: boolean
  isSample: boolean
  interestCount: number
  createdAt: string
  decidedAt: string | null
}

export interface ModerationQueue {
  pending: ModerationPost[]
  decided: ModerationPost[]
}
