import type { MenuItem } from '@shared/types'
import { useState } from 'react'
import { cx } from '../../lib/cx'
import { Mountains } from '../ui/Art'

function hash(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Whether to show the item's photo. False when the team has not added one, or the file failed to load. */
export function useItemPhoto(item: Pick<MenuItem, 'imageUrl'>) {
  const [failed, setFailed] = useState(false)
  return { showPhoto: !!item.imageUrl && !failed, onError: () => setFailed(true) }
}

interface ItemImageProps {
  item: Pick<MenuItem, 'name' | 'slug' | 'imageUrl'>
  showPhoto: boolean
  onPhotoError: () => void
  /** Set the item's name on the fallback panel. The card does this so the name appears once. */
  nameOnFallback?: boolean
  className?: string
}

/**
 * The item's photo when the team has added one, otherwise a calm tone-on-tone panel with the name
 * set in the display face. Never a broken image, never a grey box.
 */
export function ItemImage({ item, showPhoto, onPhotoError, nameOnFallback = false, className }: ItemImageProps) {
  return (
    <div className={cx('relative overflow-hidden bg-raised', className)}>
      {showPhoto ? (
        <img
          src={item.imageUrl!}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={onPhotoError}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <>
          <div className="absolute inset-x-0 bottom-0 h-[46%]">
            <Mountains flip={hash(item.slug) % 2 === 1} />
          </div>
          {nameOnFallback && (
            <span className="absolute inset-x-0 top-0 p-3 font-display text-headline font-semibold leading-tight text-ink">
              {item.name}
            </span>
          )}
        </>
      )}
    </div>
  )
}
