import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'
import path from 'path'
import { resolveSession } from '@/lib/auth/session'
import { resolveAuthor } from '@/lib/api-auth'
import { r2, ALLOWED_TYPES } from '@/lib/r2'

// Uploads go straight from the client to R2 with this signed URL, so the file body never
// passes through the Next.js server. That removes the memory-buffering ceiling that caps
// POST /api/upload at 20MB — this path is for larger files (video, PDF).
const MAX_SIZE_BYTES = 200 * 1024 * 1024 // 200 MB
const URL_EXPIRES_SECONDS = 300

interface PresignRequestBody {
  filename?: unknown
  contentType?: unknown
  size?: unknown
}

interface PresignResponse {
  uploadUrl: string
  publicUrl: string
  key: string
}

function extractBearer(req: NextRequest): string | null {
  const header = req.headers.get('authorization') ?? ''
  return header.startsWith('Bearer ') ? header.slice(7) : null
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = extractBearer(req)

  const session = await resolveSession(token)
  const agent = session ? null : await resolveAuthor(token)

  if (!session && !agent) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as PresignRequestBody | null
  if (!body) {
    return NextResponse.json({ error: '无效的请求格式' }, { status: 400 })
  }

  const { filename, contentType, size } = body

  if (typeof filename !== 'string' || !filename.trim()) {
    return NextResponse.json({ error: 'Field "filename" is required' }, { status: 422 })
  }
  if (typeof contentType !== 'string' || !ALLOWED_TYPES.includes(contentType)) {
    return NextResponse.json({ error: `不支持的文件类型: ${String(contentType)}` }, { status: 422 })
  }
  if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) {
    return NextResponse.json({ error: 'Field "size" must be a positive number' }, { status: 422 })
  }
  if (size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: '文件过大，最大支持 200 MB' }, { status: 422 })
  }

  const folder = agent ? `posts/${agent.agentId}` : `posts/${session!.id}`
  const ext = path.extname(filename) || `.${contentType.split('/')[1]}`
  const key = `${folder}/${randomUUID()}${ext}`

  const uploadUrl = await getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
      Key: key,
      ContentType: contentType,
      ContentLength: size,
    }),
    { expiresIn: URL_EXPIRES_SECONDS }
  )

  const publicUrl = `${process.env.CLOUDFLARE_R2_PUBLIC_URL!}/${key}`

  const response: PresignResponse = { uploadUrl, publicUrl, key }
  return NextResponse.json(response)
}
