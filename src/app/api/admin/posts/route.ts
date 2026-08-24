import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminSession } from '@/lib/admin-auth'
import { markdownToHtml } from '@/lib/markdown'
import { toAuthorDisplay, toAuthorSlug } from '@/lib/author'

export async function GET() {
  if (!await requireAdminSession()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()
  const { data: posts, error } = await supabase
    .from('ai_pulse_stories')
    .select('id, slug, title, content_type, author_slug, author_display, status, featured, published_at')
    .order('published_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ posts: posts ?? [] })
}

export async function POST(req: NextRequest) {
  if (!await requireAdminSession()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { slug, title, content, excerpt = '', content_type = 'dive', status = 'draft', published_at, is_premium = false, featured = false, author_slug, author_display } = body
  if (typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: 'Slug must be lowercase alphanumeric with hyphens' }, { status: 422 })
  }
  if (typeof title !== 'string' || !title.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 422 })
  if (typeof content !== 'string' || !content.trim()) return NextResponse.json({ error: 'Content is required' }, { status: 422 })
  if (!['intel', 'dive', 'insight'].includes(content_type)) return NextResponse.json({ error: 'Invalid content type' }, { status: 422 })
  if (!['draft', 'published'].includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 422 })

  const supabase = await createServiceClient()
  const { data: existing } = await supabase.from('ai_pulse_stories').select('id').eq('slug', slug).maybeSingle()
  if (existing) return NextResponse.json({ error: 'Slug already exists' }, { status: 409 })

  let html: string
  try {
    html = await markdownToHtml(content)
  } catch {
    return NextResponse.json({ error: 'Failed to render markdown content' }, { status: 422 })
  }

  const display = toAuthorDisplay(author_display ?? author_slug)
  const { data: post, error } = await supabase.from('ai_pulse_stories').insert({
    slug,
    title: title.trim(),
    content: html,
    body_markdown: content,
    excerpt: typeof excerpt === 'string' ? excerpt.trim() : '',
    content_type,
    status,
    published_at: status === 'published' ? (published_at || new Date().toISOString()) : null,
    is_premium: Boolean(is_premium),
    featured: Boolean(featured),
    author_slug: toAuthorSlug(author_slug ?? author_display),
    author_display: display,
  }).select('slug').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePostPaths(post.slug)
  return NextResponse.json({ ok: true, slug: post.slug }, { status: 201 })
}

function revalidatePostPaths(slug: string) {
  revalidatePath('/')
  revalidatePath('/intels')
  revalidatePath('/dives')
  revalidatePath('/insights')
  revalidatePath('/archive')
  revalidatePath(`/post/${slug}`)
}
