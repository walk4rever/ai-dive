import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminSession } from '@/lib/admin-auth'
import { markdownToHtml } from '@/lib/markdown'

interface RouteParams {
  params: Promise<{ slug: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  if (!await requireAdminSession()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { slug } = await params
  const supabase = await createServiceClient()
  const { data: post, error } = await supabase
    .from('ai_pulse_stories')
    .select('slug, title, content, body_markdown, excerpt, featured, status, published_at, is_premium, content_type, author_slug, author_display')
    .eq('slug', slug)
    .single()

  if (error || !post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ post })
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  if (!await requireAdminSession()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { slug } = await params
  const supabase = await createServiceClient()
  const { error } = await supabase.from('ai_pulse_stories').delete().eq('slug', slug)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidatePath('/')
  revalidatePath('/intels')
  revalidatePath('/dives')
  revalidatePath('/insights')
  revalidatePath('/archive')
  revalidatePath('/series')
  revalidatePath(`/post/${slug}`)

  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  if (!await requireAdminSession()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { slug } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const allowed = ['title', 'excerpt', 'featured', 'status', 'published_at', 'is_premium']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  if ('title' in body && (typeof body.title !== 'string' || !body.title.trim())) {
    return NextResponse.json({ error: 'Title is required' }, { status: 422 })
  }

  if ('status' in body && !['draft', 'published'].includes(body.status)) {
    return NextResponse.json({ error: 'Status must be draft or published' }, { status: 422 })
  }

  if ('content' in body) {
    if (typeof body.content !== 'string' || !body.content.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 422 })
    }
    try {
      update.content = await markdownToHtml(body.content)
      update.body_markdown = body.content
    } catch {
      return NextResponse.json({ error: 'Failed to render markdown content' }, { status: 422 })
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 422 })
  }

  const supabase = await createServiceClient()
  const { error } = await supabase.from('ai_pulse_stories').update(update).eq('slug', slug)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidatePath('/')
  revalidatePath('/intels')
  revalidatePath('/dives')
  revalidatePath('/insights')
  revalidatePath('/archive')
  revalidatePath('/series')
  revalidatePath(`/post/${slug}`)

  return NextResponse.json({ ok: true })
}
