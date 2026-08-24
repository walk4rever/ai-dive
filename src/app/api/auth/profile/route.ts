import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createServiceClient()
  const { data } = await supabase
    .from('ai_pulse_users')
    .select('email, username, role')
    .eq('id', session.user.id)
    .single()

  return NextResponse.json({ profile: data })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { username } = body

  if (!username || !/^[a-zA-Z0-9-]{3,30}$/.test(username)) {
    return NextResponse.json(
      { error: 'Username must be 3–30 characters: letters, numbers, hyphens only' },
      { status: 422 }
    )
  }

  const supabase = await createServiceClient()

  // Check uniqueness
  const { data: taken } = await supabase
    .from('ai_pulse_users')
    .select('id')
    .ilike('username', username)
    .neq('id', user.id)
    .single()

  if (taken) return NextResponse.json({ error: 'Username already taken' }, { status: 409 })

  // Get current username before updating
  const { data: current } = await supabase
    .from('ai_pulse_users')
    .select('username')
    .eq('id', user.id)
    .single()

  const { error } = await supabase
    .from('ai_pulse_users')
    .update({ username })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sync author identity on posts that were signed with the old username
  if (current?.username) {
    await supabase
      .from('ai_pulse_stories')
      .update({ author_slug: username.toLowerCase(), author_display: username })
      .eq('user_id', user.id)
      .or(`author_slug.eq.${current.username.toLowerCase()},author_display.eq.${current.username}`)
  }

  return NextResponse.json({ ok: true, username })
}
