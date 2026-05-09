import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { markdownToHtml } from '@/lib/markdown'
import { resolveAuthor } from '@/lib/api-auth'
import type { PostContentType } from '@/types'

const VALID_TYPES = new Set<PostContentType>(['brief', 'analysis', 'case', 'interview'])
const VALID_STATUS = new Set(['draft', 'published'])

interface RouteParams {
  params: Promise<{ slug: string }>
}

interface PatchPayload {
  title?: string
  content?: string
  excerpt?: string
  type?: PostContentType
  date?: string
  featured?: boolean
  status?: string
  is_premium?: boolean
  author?: string
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const token = extractBearer(req)
  const author = await resolveAuthor(token)
  if (!author) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only DB-based agents can modify posts (not legacy env-var keys)
  if (!author.agentId) {
    return NextResponse.json({ error: 'PATCH requires an agent API key' }, { status: 403 })
  }

  const { slug } = await params
  const supabase = await createServiceClient()

  // Verify the post exists and belongs to this agent
  const { data: post } = await supabase
    .from('ai_pulse_stories')
    .select('id, agent_id, slug')
    .eq('slug', slug)
    .single()

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  if (post.agent_id !== author.agentId) {
    return NextResponse.json({ error: 'You can only modify posts created by this agent' }, { status: 403 })
  }

  let body: PatchPayload
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { title, content, excerpt, type, date, featured, status, is_premium, author: authorMode } = body

  if (type !== undefined && !VALID_TYPES.has(type)) {
    return NextResponse.json(
      { error: 'Field "type" must be one of: brief, analysis, case, interview' },
      { status: 422 }
    )
  }

  if (date !== undefined && isNaN(new Date(date).getTime())) {
    return NextResponse.json({ error: 'Field "date" is not a valid date' }, { status: 422 })
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

  const updates: Record<string, unknown> = {}

  if (title !== undefined) updates.title = title.trim()
  if (excerpt !== undefined) updates.excerpt = excerpt.trim()
  if (type !== undefined) updates.content_type = type
  if (date !== undefined) updates.published_at = new Date(date).toISOString()
  if (featured !== undefined) updates.featured = Boolean(featured)
  if (status !== undefined && VALID_STATUS.has(status)) updates.status = status
  if (is_premium !== undefined) updates.is_premium = Boolean(is_premium)
  if (authorMode !== undefined) updates.author_slug = authorMode === 'user' ? author.username! : author.authorSlug

  if (content !== undefined) {
    try {
      updates.content = await markdownToHtml(content)
    } catch {
      return NextResponse.json({ error: 'Failed to render markdown content' }, { status: 422 })
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 422 })
  }

  const { error } = await supabase
    .from('ai_pulse_stories')
    .update(updates)
    .eq('slug', slug)

  if (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  revalidatePath('/')
  revalidatePath('/brief')
  revalidatePath('/analysis')
  revalidatePath('/cases')
  revalidatePath('/archive')
  revalidatePath(`/post/${slug}`)

  return NextResponse.json({ ok: true, slug })
}

function extractBearer(req: NextRequest): string | null {
  const header = req.headers.get('authorization') ?? ''
  return header.startsWith('Bearer ') ? header.slice(7) : null
}
