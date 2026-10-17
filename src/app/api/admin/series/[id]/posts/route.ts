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
  topic_order: number
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  if (!await requireAdminSession()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const supabase = await createServiceClient()

  const { data, error } = await supabase
    .from('ai_pulse_stories')
    .select('id, slug, title, content_type, status, published_at, topic_order')
    .eq('topic_id', id)
    .order('topic_order', { ascending: true })
    .order('id', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const posts = ((data ?? []) as StoryRow[]).map((story) => ({
    post_id: story.id,
    order_index: story.topic_order,
    joined_at: story.published_at ?? '',
    post: story,
  }))

  return NextResponse.json({ posts })
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  if (!await requireAdminSession()) {
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
    .select('id, topic_id')
    .eq('id', storyId)
    .single()

  if (fetchError || !story) {
    return NextResponse.json({ error: 'Story not found' }, { status: 404 })
  }

  if (story.topic_id === topicId) {
    return NextResponse.json({ error: 'Story already in this topic' }, { status: 409 })
  }
  if (story.topic_id) {
    return NextResponse.json({ error: 'Story already belongs to another topic' }, { status: 409 })
  }

  const { data: lastStory, error: orderError } = await supabase
    .from('ai_pulse_stories')
    .select('topic_order')
    .eq('topic_id', topicId)
    .order('topic_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 })

  const nextOrder = (lastStory?.topic_order ?? 0) + 1

  const { error } = await supabase
    .from('ai_pulse_stories')
    .update({ topic_id: topicId, topic_order: nextOrder })
    .eq('id', storyId)

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Topic order changed, please retry' }, { status: 409 })
    }
    if (error.code === '23503') {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, topic_order: nextOrder }, { status: 201 })
}
