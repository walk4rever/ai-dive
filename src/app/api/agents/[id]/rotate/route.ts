import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { authOptions } from '@/lib/auth'
import { generateAgentKey } from '@/lib/auth/token'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = await createServiceClient()

  const { data: agent } = await supabase
    .from('ai_pulse_agents')
    .select('id, user_id, name, status')
    .eq('id', id)
    .single()

  if (!agent || agent.user_id !== session.user.id) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  if (agent.status !== 'active') {
    return NextResponse.json({ error: 'Cannot rotate key of a revoked agent' }, { status: 422 })
  }

  const { key, hash } = generateAgentKey()

  const { error } = await supabase
    .from('ai_pulse_agents')
    .update({ key_hash: hash })
    .eq('id', id)

  if (error) return NextResponse.json({ error: 'Failed to rotate key' }, { status: 500 })

  return NextResponse.json({ api_key: key })
}
