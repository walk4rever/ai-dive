import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminSession } from '@/lib/admin-auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

interface StoryRow {
  id: string
  slug: string
  title: string
  content_type: string
  status: string
  published_at: string | null
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  if (!await requireAdminSession(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const supabase = await createServiceClient()

  const { data, error } = await supabase
    .from('ai_pulse_stories')
    .select('id, slug, title, content_type, status, published_at')
    .contains('topic_ids', [id])
    .order('published_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const posts = ((data ?? []) as StoryRow[]).map((story) => ({
    post_id: story.id,
    order_index: 0,
    joined_at: story.published_at ?? '',
    post: story,
  }))

  return NextResponse.json({ posts })
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  if (!await requireAdminSession(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: topicId } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const storyId = typeof body.post_id === 'string' ? body.post_id.trim() : ''
  if (!storyId) return NextResponse.json({ error: 'Field "post_id" is required' }, { status: 422 })

  const supabase = await createServiceClient()

  const { data: story, error: fetchError } = await supabase
    .from('ai_pulse_stories')
    .select('id, topic_ids')
    .eq('id', storyId)
    .single()

  if (fetchError || !story) {
    return NextResponse.json({ error: 'Story not found' }, { status: 404 })
  }

  const currentIds: string[] = story.topic_ids ?? []
  if (currentIds.includes(topicId)) {
    return NextResponse.json({ error: 'Story already in this topic' }, { status: 409 })
  }

  const { error } = await supabase
    .from('ai_pulse_stories')
    .update({ topic_ids: [...currentIds, topicId] })
    .eq('id', storyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true }, { status: 201 })
}
