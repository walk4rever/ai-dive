import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminSession } from '@/lib/admin-auth'

interface RouteParams {
  params: Promise<{ id: string; postId: string }>
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  if (!await requireAdminSession()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: topicId, postId: storyId } = await params
  const supabase = await createServiceClient()

  const { data: story, error: fetchError } = await supabase
    .from('ai_pulse_stories')
    .select('id, topic_id')
    .eq('id', storyId)
    .single()

  if (fetchError || !story) {
    return NextResponse.json({ error: 'Story not found' }, { status: 404 })
  }

  if (story.topic_id !== topicId) {
    return NextResponse.json({ error: 'Story is not in this topic' }, { status: 404 })
  }

  const { error } = await supabase
    .from('ai_pulse_stories')
    .update({ topic_id: null, topic_order: null })
    .eq('id', storyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  if (!await requireAdminSession()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: topicId, postId: storyId } = await params
  const body = await req.json().catch(() => null)
  const direction = body?.direction

  if (direction !== 'up' && direction !== 'down') {
    return NextResponse.json({ error: 'Direction must be up or down' }, { status: 422 })
  }

  const supabase = await createServiceClient()
  const { error } = await supabase.rpc('move_topic_story', {
    p_topic_id: topicId,
    p_story_id: storyId,
    p_direction: direction,
  })

  if (error) {
    if (error.message.includes('Story is not in this topic')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
