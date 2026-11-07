import { api } from './api'

/**
 * Shrinks a picture in the browser before it is sent, so a phone photo of several megabytes becomes a
 * few hundred kilobytes and uploads quickly on slow Wi-Fi. Returns a JPEG data URL.
 */
export async function resizeToDataUrl(file: File, maxEdge = 1200, maxBytes = 900_000): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Choose a JPEG, PNG or WebP picture.')
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error("This browser can't resize pictures.")
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  for (const quality of [0.86, 0.74, 0.62, 0.5]) {
    const url = canvas.toDataURL('image/jpeg', quality)
    // A data URL is about 4/3 the size of the bytes it carries.
    if (url.length * 0.75 <= maxBytes) return url
  }
  throw new Error('That picture is still too large after shrinking. Try a smaller one.')
}

/** Resize and upload from the dashboard. Returns the picture's address on this server. */
export async function uploadDashboardImage(file: File, folder: 'menu' | 'promo' | 'events'): Promise<string> {
  const dataUrl = await resizeToDataUrl(file)
  const res = await api<{ url: string }>('/dashboard/uploads', { body: { dataUrl, folder } })
  return res.url
}
