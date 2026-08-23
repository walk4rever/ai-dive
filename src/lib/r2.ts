import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import path from 'path'
import { lookup } from 'mime-types'
import type { ImageAttachment } from './image-attachment'

export const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
})

// Shared with the presign route (src/app/api/upload/presign/route.ts) so both
// upload paths accept the same file types.
export const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'audio/mpeg',
  'audio/wav',
  'video/mp4',
  'video/webm',
  'application/pdf',
]
const MAX_SIZE_BYTES = 20 * 1024 * 1024 // 20 MB, enforced here because this path buffers the whole file in server memory

export interface UploadResult {
  url: string
  key: string
}

export async function uploadToR2(file: File, folder = 'posts'): Promise<UploadResult> {
  // Use file.type first, fallback to extension lookup
  const contentType = file.type || lookup(file.name) || 'application/octet-stream'

  if (!ALLOWED_TYPES.includes(contentType)) {
    throw new Error(`不支持的文件类型: ${contentType}`)
  }

  if (file.size > MAX_SIZE_BYTES) {
    throw new Error(`文件过大，最大支持 20 MB`)
  }

  const ext = path.extname(file.name) || `.${contentType.split('/')[1]}`
  const key = `${folder}/${randomUUID()}${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())

  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  )

  const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL!
  return { url: `${publicUrl}/${key}`, key }
}

// Separate key space from the site's own content (which lives under posts/...) so
// anything stored "for a user" — chat images today, future user uploads/exports —
// can be audited or cleaned up per-user without touching public content keys.
export function buildUserObjectKey(userId: string, category: string, filename: string): string {
  return `users/${userId}/${category}/${filename}`
}

/** Uploads a base64-encoded chat image attachment to R2 and returns its public URL. */
export async function uploadBase64ToR2(userId: string, category: string, image: ImageAttachment): Promise<string> {
  const ext = image.mimeType.split('/')[1] ?? 'bin'
  const key = buildUserObjectKey(userId, category, `${randomUUID()}.${ext}`)
  const buffer = Buffer.from(image.data, 'base64')

  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: image.mimeType,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  )

  return `${process.env.CLOUDFLARE_R2_PUBLIC_URL!}/${key}`
}
