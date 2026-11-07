import { randomBytes } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { config } from '../config'
import { OrderError } from '../domain/pricing'

/**
 * Image uploads. The browser shrinks the picture first and sends it as a data URL; this checks that
 * the bytes really are an image (by their first bytes, not by what the browser claims), caps the size,
 * and saves it under a random name. Nothing the user typed is ever used in the file name.
 */

const MAX_BYTES = 1_200_000

function sniff(buf: Buffer): { ext: string; mime: string } | null {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' }
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', mime: 'image/png' }
  if (buf.length > 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return { ext: 'webp', mime: 'image/webp' }
  return null
}

export type UploadFolder = 'menu' | 'promo' | 'events'

/** Saves a data URL and returns its public URL, for example /uploads/menu/9f2c1a....jpg */
export function saveImageDataUrl(dataUrl: string, folder: UploadFolder): string {
  const match = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  if (!match) throw new OrderError('That file is not a JPEG, PNG or WebP image.', 'invalid_image')
  const buf = Buffer.from(match[1], 'base64')
  if (buf.length > MAX_BYTES) throw new OrderError('That image is too large. Pick one under 1 MB.', 'image_too_large', 413)
  const type = sniff(buf)
  if (!type) throw new OrderError('That file is not a JPEG, PNG or WebP image.', 'invalid_image')

  const dir = join(config.uploadDir, folder)
  mkdirSync(dir, { recursive: true })
  const name = `${randomBytes(12).toString('hex')}.${type.ext}`
  writeFileSync(join(dir, name), buf)
  return `/uploads/${folder}/${name}`
}

/** Only images we saved (or the team dropped in public/images) may be set as a picture. */
export function assertLocalImage(url: string | null | undefined): string | null {
  if (!url) return null
  if (!/^\/(uploads|images)\/[A-Za-z0-9_./-]+$/.test(url) || url.includes('..')) {
    throw new OrderError('That image address is not allowed.', 'invalid_image')
  }
  return url
}
