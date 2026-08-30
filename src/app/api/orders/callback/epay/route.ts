import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getProviderByName } from '@/lib/payments'
import { markOrderPaid } from '@/lib/payments/settle'

/** Async payment notification from the epay-protocol aggregator (GET, per protocol —
 *  see src/lib/payments/epay.ts). The provider retries this endpoint until it gets
 *  back the literal string "success", so every early return here must be something
 *  other than that string, or a genuinely failed/invalid callback would look
 *  acknowledged and never get retried. */
export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries())

  let result
  try {
    result = getProviderByName('epay').verifyCallback(params)
  } catch {
    return new Response('fail', { status: 500 })
  }

  if (!result) return new Response('fail', { status: 400 })

  const supabase = await createServiceClient()
  const outcome = await markOrderPaid(supabase, 'epay', result)

  if (outcome === 'paid' || outcome === 'already_paid') return new Response('success')

  console.error('[epay-callback]', outcome, result.outTradeNo, result.providerOrderId)
  return new Response('fail', { status: outcome === 'error' ? 500 : 400 })
}
