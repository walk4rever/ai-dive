import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { authOptions } from '@/lib/auth'
import { generateAgentKey } from '@/lib/auth/token'

const MAX_AGENTS_PER_USER = 3

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user

  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('ai_pulse_agents')
    .select('id, name, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 })

  return NextResponse.json({ agents: data })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user

  let body: { name?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { name } = body
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Agent name is required' }, { status: 422 })
  }

  const supabase = await createServiceClient()

  const { count } = await supabase
    .from('ai_pulse_agents')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'active')

  if ((count ?? 0) >= MAX_AGENTS_PER_USER) {
    return NextResponse.json(
      { error: `Maximum ${MAX_AGENTS_PER_USER} agents per user` },
      { status: 422 }
    )
  }

  const { key, hash } = generateAgentKey()

  const { data, error } = await supabase
    .from('ai_pulse_agents')
    .insert({ user_id: user.id, name: name.trim(), key_hash: hash })
    .select('id, name, status, created_at')
    .single()

  if (error) return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 })

  // Return key only once — not stored in plain text
  return NextResponse.json({ agent: data, api_key: key }, { status: 201 })
}
