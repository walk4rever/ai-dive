import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { authOptions } from '@/lib/auth'
import { markdownToHtml } from '@/lib/markdown'
import { toAuthorSlug } from '@/lib/author'

interface RouteParams {
  params: Promise<{ slug: string }>
}

async function verifyOwnership(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  slug: string,
  userId: string
) {
  const { data: post } = await supabase
    .from('ai_pulse_stories')
    .select('slug, agent_id, user_id, title, content, body_markdown, excerpt, featured, status, published_at, is_premium, content_type, author_slug, author_display')
    .eq('slug', slug)
    .eq('user_id', userId)
    .single()

  return post ?? null
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params
  const supabase = await createServiceClient()
  const post = await verifyOwnership(supabase, slug, session.user.id)

  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ post })
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params
  const supabase = await createServiceClient()
  const post = await verifyOwnership(supabase, slug, session.user.id)
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const allowed = ['title', 'excerpt', 'status', 'published_at', 'is_premium']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  if ('content' in body) {
    if (typeof body.content !== 'string' || !body.content.trim()) return NextResponse.json({ error: 'Content is required' }, { status: 422 })
    try {
      update.content = await markdownToHtml(body.content)
      update.body_markdown = body.content
    } catch {
      return NextResponse.json({ error: 'Failed to render markdown content' }, { status: 422 })
    }
  }

  if ('author_display' in body && typeof body.author_display === 'string') {
    if (body.author_display.trim()) {
      update.author_display = body.author_display.trim()
      update.author_slug = toAuthorSlug(body.author_display)
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 422 })
  }

  const { error } = await supabase.from('ai_pulse_stories').update(update).eq('slug', slug)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidatePath('/')
  revalidatePath('/archive')
  revalidatePath(`/post/${slug}`)

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params
  const supabase = await createServiceClient()
  const post = await verifyOwnership(supabase, slug, session.user.id)
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await supabase.from('ai_pulse_stories').delete().eq('slug', slug)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidatePath('/')
  revalidatePath('/archive')
  revalidatePath(`/post/${slug}`)

  return NextResponse.json({ ok: true })
}
