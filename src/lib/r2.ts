import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import path from 'path'
import { lookup } from 'mime-types'

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
})

const ALLOWED_TYPES = [
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
const MAX_SIZE_BYTES = 20 * 1024 * 1024 // 20 MB

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
