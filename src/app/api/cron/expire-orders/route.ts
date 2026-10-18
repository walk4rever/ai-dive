import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { expireStalePendingOrders } from '@/lib/orders/expire'

/** Daily sweep behind lazy expiry: users see stale rows disappear on their next
 *  dashboard render, and this keeps rows for users who never come back from
 *  accumulating as `pending` forever. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createServiceClient()
    const ok = await expireStalePendingOrders(supabase)
    return NextResponse.json({ ok }, { status: ok ? 200 : 500 })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
