import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

/** Hides an order from the caller's dashboard. Paid rows stay in the table because
 *  they are both the access entitlement and the payment receipt; deleting one must
 *  never revoke the content the user bought. */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = await createServiceClient()

  const { data: order, error: lookupError } = await supabase
    .from('ai_pulse_orders')
    .select('id, status')
    .eq('id', id)
    .eq('user_id', session.user.id)
    .maybeSingle()

  if (lookupError) return NextResponse.json({ error: 'Failed to load order' }, { status: 500 })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const now = new Date().toISOString()
  const patch =
    order.status === 'pending'
      ? {
          status: 'cancelled',
          cancelled_at: now,
          cancel_reason: 'user',
          user_deleted_at: now,
        }
      : { user_deleted_at: now }

  const { error: updateError } = await supabase
    .from('ai_pulse_orders')
    .update(patch)
    .eq('id', id)
    .eq('user_id', session.user.id)

  if (updateError) return NextResponse.json({ error: 'Failed to delete order' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
