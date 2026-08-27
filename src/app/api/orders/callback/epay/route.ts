import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getPaymentProvider } from '@/lib/payments'

/** Async payment notification from the epay-protocol aggregator (GET, per protocol —
 *  see src/lib/payments/epay.ts). The provider retries this endpoint until it gets
 *  back the literal string "success", so every early return here must be something
 *  other than that string, or a genuinely failed/invalid callback would look
 *  acknowledged and never get retried. */
export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries())

  let result
  try {
    result = getPaymentProvider().verifyCallback(params)
  } catch {
    return new Response('fail', { status: 500 })
  }

  if (!result) return new Response('fail', { status: 400 })

  const supabase = await createServiceClient()

  // Guarded by status='pending' so a retried callback (the aggregator resends until
  // it sees "success") is a no-op the second time, not a double-processed payment.
  const { error } = await supabase
    .from('ai_pulse_orders')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      provider_order_id: result.providerOrderId,
    })
    .eq('id', result.outTradeNo)
    .eq('status', 'pending')

  if (error) return new Response('fail', { status: 500 })

  return new Response('success')
}
