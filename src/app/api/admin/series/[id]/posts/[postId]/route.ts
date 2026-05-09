import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminSession } from '@/lib/admin-auth'

interface RouteParams {
  params: Promise<{ id: string; postId: string }>
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  if (!await requireAdminSession(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: topicId, postId: storyId } = await params
  const supabase = await createServiceClient()

  const { data: story, error: fetchError } = await supabase
    .from('ai_pulse_stories')
    .select('id, topic_ids')
    .eq('id', storyId)
    .single()

  if (fetchError || !story) {
    return NextResponse.json({ error: 'Story not found' }, { status: 404 })
  }

  const newIds = (story.topic_ids ?? []).filter((id: string) => id !== topicId)

  const { error } = await supabase
    .from('ai_pulse_stories')
    .update({ topic_ids: newIds })
    .eq('id', storyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
