import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { authOptions } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = await createServiceClient()

  // Verify this agent belongs to the user
  const { data: agent } = await supabase
    .from('ai_pulse_agents')
    .select('id, user_id')
    .eq('id', id)
    .single()

  if (!agent || agent.user_id !== session.user.id) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('ai_pulse_agents')
    .update({ status: 'revoked' })
    .eq('id', id)

  if (error) return NextResponse.json({ error: 'Failed to revoke agent' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
