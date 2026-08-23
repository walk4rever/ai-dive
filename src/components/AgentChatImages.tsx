'use client'

import { useState, type ClipboardEvent } from 'react'
import type { ImageAttachment } from '@/hooks/useAgentChat'
import { fileToImageAttachment, isSupportedImageFile } from '@/lib/downscale-image'

export function imageSrc(img: ImageAttachment): string {
  return `data:${img.mimeType};base64,${img.data}`
}

/** Reads image files out of a paste event and hands each one (downscaled) to
 *  `onAdd`. Only calls preventDefault when it actually finds an image, so a
 *  normal text paste into the textarea is untouched. */
export async function handleClipboardImages(
  e: ClipboardEvent<HTMLTextAreaElement>,
  onAdd: (image: ImageAttachment) => void
): Promise<void> {
  const files = Array.from(e.clipboardData.items)
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => !!file && isSupportedImageFile(file))

  if (files.length === 0) return
  e.preventDefault()

  for (const file of files) {
    try {
      onAdd(await fileToImageAttachment(file))
    } catch {
      // Skip files that fail to decode (e.g. corrupt clipboard data).
    }
  }
}

interface PendingImageChipsProps {
  images: ImageAttachment[]
  onRemove: (index: number) => void
}

export function PendingImageChips({ images, onRemove }: PendingImageChipsProps) {
  if (images.length === 0) return null
  return (
    <div className="flex gap-2 mb-2 flex-wrap">
      {images.map((img, i) => (
        <div key={i} className="relative flex-shrink-0" style={{ width: '48px', height: '48px' }}>
          <img
            src={imageSrc(img)}
            alt=""
            className="w-full h-full object-cover"
            style={{ borderRadius: '8px', border: '1px solid var(--border)' }}
          />
          <button
            type="button"
            onClick={() => onRemove(i)}
            aria-label="移除图片"
            className="absolute flex items-center justify-center leading-none"
            style={{
              top: '-6px',
              right: '-6px',
              width: '18px',
              height: '18px',
              borderRadius: '999px',
              background: '#30302e',
              color: '#faf9f5',
              fontSize: '12px',
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

interface MessageImagesProps {
  images?: ImageAttachment[]
  imageUrls?: string[]
  onOpen: (src: string) => void
}

// Merges two image sources into one rendered row: base64 attachments (the current,
// just-sent turn) and R2 public URLs (turns reloaded from persisted history) — both
// render fine as a plain <img src>, no proxy needed for the URL case.
export function MessageImages({ images = [], imageUrls = [], onOpen }: MessageImagesProps) {
  const sources = [...images.map(imageSrc), ...imageUrls]
  if (sources.length === 0) return null
  return (
    <div className="flex gap-2 mb-2 flex-wrap justify-end">
      {sources.map((src, i) => (
        <img
          key={i}
          src={src}
          alt=""
          onClick={() => onOpen(src)}
          className="cursor-zoom-in object-cover"
          style={{ width: '96px', height: '96px', borderRadius: '10px', border: '1px solid var(--border)' }}
        />
      ))}
    </div>
  )
}

/** Owns click-to-zoom lightbox state — call `open(src)` from an image's
 *  onClick, render `node` once at the end of the chat component. */
export function useImageLightbox() {
  const [src, setSrc] = useState<string | null>(null)
  const node = src ? (
    <div
      onClick={() => setSrc(null)}
      className="fixed inset-0 z-50 flex items-center justify-center cursor-zoom-out"
      style={{ background: 'rgba(20,20,19,0.85)', padding: '2rem' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="max-w-full max-h-full object-contain" style={{ borderRadius: '8px' }} />
    </div>
  ) : null
  return { open: setSrc, node }
}
