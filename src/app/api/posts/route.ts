import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { markdownToHtml } from '@/lib/markdown'
import { resolveAuthor } from '@/lib/api-auth'
import type { PostContentType } from '@/types'

const VALID_TYPES = new Set<PostContentType>(['analysis', 'case', 'podcast', 'invest'])
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
  author?: string
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
    .select('id, slug, title, excerpt, content_type, author_slug, agent_id, published_at, featured, is_premium, content')
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

  const { slug, title, content, type, date, excerpt, featured, status, is_premium, author: authorMode } = body

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
      { error: 'Field "type" must be one of: analysis, case, podcast, invest' },
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

  let html: string
  try {
    html = await markdownToHtml(content)
  } catch {
    return NextResponse.json({ error: 'Failed to render markdown content' }, { status: 422 })
  }

  const resolvedStatus = VALID_STATUS.has(status ?? '') ? status! : 'published'
  const publishedAt = date ? new Date(date).toISOString() : new Date().toISOString()
  const resolvedAuthorSlug = authorMode === 'user' ? author.username! : author.authorSlug

  const supabase = await createServiceClient()
  const { error } = await supabase.from('ai_pulse_stories').upsert(
    {
      slug,
      title: title.trim(),
      content: html,
      excerpt: excerpt.trim(),
      content_type: type,
      author_slug: resolvedAuthorSlug,
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
  revalidatePath('/analysis')
  revalidatePath('/cases')
  revalidatePath('/invest')
  revalidatePath('/archive')
  revalidatePath(`/post/${slug}`)

  return NextResponse.json({ ok: true, slug, author: resolvedAuthorSlug }, { status: 200 })
}

function extractBearer(req: NextRequest): string | null {
  const header = req.headers.get('authorization') ?? ''
  return header.startsWith('Bearer ') ? header.slice(7) : null
}
