import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { markdownToHtml } from '@/lib/markdown'
import { resolveAuthor } from '@/lib/api-auth'
import { uploadToR2 } from '@/lib/r2'
import type { PostContentType } from '@/types'

export const runtime = 'nodejs'

const VALID_TYPES = new Set<PostContentType>(['intel', 'dive'])
const VALID_STATUS = new Set(['draft', 'published'])

interface PostPayload {
  slug: string
  title: string
  content: string
  type: PostContentType
  date?: string
  excerpt: string
  featured?: boolean
  status?: string
  is_premium?: boolean
  author?: string // 署名模式：'agent' | 'user'（历史字段，非作者名）
  source?: string // 来源名（2026-10-30 规范）；缺省取 API key 署名
  source_url?: string
  byline?: string // 真实署名作者（写 DB author 列；author 字段已被署名模式占用）
}

function extractFirstMarkdownImageUrl(markdown: string): string | null {
  const match = markdown.match(/!\[[^\]]*\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)/)
  return match?.[1] ? match[1] : null
}

function replaceFirstMarkdownImageUrl(markdown: string, nextUrl: string): string {
  return markdown.replace(/(!\[[^\]]*\]\()([^)\s]+)((?:\s+\"[^\"]*\")?\))/, `$1${nextUrl}$3`)
}

function isYouTubeThumbnailUrl(url: URL): boolean {
  if (url.protocol !== 'https:') return false
  if (url.hostname !== 'i.ytimg.com') return false
  return url.pathname.startsWith('/vi/')
}

function isR2PublicUrl(url: URL): boolean {
  const base = process.env.CLOUDFLARE_R2_PUBLIC_URL
  if (!base) return false
  try {
    const baseUrl = new URL(base)
    return url.protocol === baseUrl.protocol && url.hostname === baseUrl.hostname
  } catch {
    return false
  }
}

async function mirrorYouTubeCoverToR2(markdown: string, folder: string): Promise<string> {
  const first = extractFirstMarkdownImageUrl(markdown)
  if (!first) return markdown

  let url: URL
  try {
    url = new URL(first)
  } catch {
    return markdown
  }

  if (isR2PublicUrl(url)) return markdown
  if (!isYouTubeThumbnailUrl(url)) return markdown

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) return markdown

  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.startsWith('image/')) return markdown

  const buffer = await res.arrayBuffer()
  const file = new File([buffer], 'cover.jpg', { type: contentType })
  const uploaded = await uploadToR2(file, folder)
  return replaceFirstMarkdownImageUrl(markdown, uploaded.url)
}

export async function GET(req: NextRequest) {
  const token = extractBearer(req)
  const author = await resolveAuthor(token)
  if (!author) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 100)
  const offset = Number(searchParams.get('offset') ?? '0')
  const type = searchParams.get('type') as PostContentType | null

  const supabase = await createServiceClient()
  let query = supabase
    .from('ai_pulse_stories')
    .select('id, slug, title, excerpt, content_type, source, author, source_url, agent_id, published_at, featured, is_premium, content')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (type && VALID_TYPES.has(type)) {
    query = query.eq('content_type', type)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 })

  return NextResponse.json({ posts: data, limit, offset })
}

export async function POST(req: NextRequest) {
  const token = extractBearer(req)
  const author = await resolveAuthor(token)
  if (!author) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: PostPayload
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { slug, title, content, type: rawType, date, excerpt, featured, status, is_premium, author: authorMode, source: sourceField, source_url: sourceUrl, byline } = body
  const type = (rawType as string) === 'insight' ? 'dive' : rawType

  if (!slug || typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      { error: 'Field "slug" is required and must be lowercase alphanumeric with hyphens' },
      { status: 422 }
    )
  }

  if (!title || typeof title !== 'string') {
    return NextResponse.json({ error: 'Field "title" is required' }, { status: 422 })
  }

  if (!content || typeof content !== 'string') {
    return NextResponse.json({ error: 'Field "content" is required (markdown string)' }, { status: 422 })
  }

  if (!VALID_TYPES.has(type)) {
    return NextResponse.json(
      { error: 'Field "type" must be one of: intel, dive' },
      { status: 422 }
    )
  }

  if (!author.allowedTypes.includes(type)) {
    return NextResponse.json(
      { error: `This API key is not authorized to publish type "${type}"` },
      { status: 403 }
    )
  }

  if (date && isNaN(new Date(date).getTime())) {
    return NextResponse.json({ error: 'Field "date" is not a valid date' }, { status: 422 })
  }

  if (!excerpt || typeof excerpt !== 'string' || !excerpt.trim()) {
    return NextResponse.json({ error: 'Field "excerpt" is required' }, { status: 422 })
  }

  if (authorMode !== undefined && authorMode !== 'agent' && authorMode !== 'user') {
    return NextResponse.json(
      { error: 'Field "author" must be either "agent" or "user"' },
      { status: 422 }
    )
  }

  if (authorMode === 'user' && !author.username) {
    return NextResponse.json({ error: 'Current user username is not available' }, { status: 422 })
  }

  let normalizedContent = content
  if (type === 'dive' && author.agentId) {
    try {
      normalizedContent = await mirrorYouTubeCoverToR2(content, `posts/${author.agentId}`)
    } catch {
      normalizedContent = content
    }
  }

  let html: string
  try {
    html = await markdownToHtml(normalizedContent)
  } catch {
    return NextResponse.json({ error: 'Failed to render markdown content' }, { status: 422 })
  }

  const resolvedStatus = VALID_STATUS.has(status ?? '') ? status! : 'published'
  const publishedAt = date ? new Date(date).toISOString() : new Date().toISOString()
  // 2026-10-30 规范：source 存来源名（缺省取 API key/用户署名），真实作者走 byline → author 列
  const resolvedSource = sourceField?.trim()
    || (authorMode === 'user' ? author.username! : author.authorDisplay)

  const supabase = await createServiceClient()
  const { error } = await supabase.from('ai_pulse_stories').upsert(
    {
      slug,
      title: title.trim(),
      content: html,
      excerpt: excerpt.trim(),
      content_type: type,
      source: resolvedSource,
      author: byline?.trim() || null,
      source_url: sourceUrl?.trim() || null,
      agent_id: author.agentId ?? null,
      user_id: author.userId ?? null,
      featured: Boolean(featured),
      is_premium: Boolean(is_premium),
      status: resolvedStatus,
      published_at: publishedAt,
    },
    { onConflict: 'slug' }
  )

  if (error) {
    console.error('[api/posts] upsert failed', { slug, message: error.message })
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  revalidatePath('/')
  revalidatePath('/intels')
  revalidatePath('/dives')
  revalidatePath(`/post/${slug}`)

  return NextResponse.json({ ok: true, slug, source: resolvedSource }, { status: 200 })
}

function extractBearer(req: NextRequest): string | null {
  const header = req.headers.get('authorization') ?? ''
  return header.startsWith('Bearer ') ? header.slice(7) : null
}
