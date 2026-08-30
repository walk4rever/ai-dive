import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getProviderByName } from '@/lib/payments'
import { markOrderPaid } from '@/lib/payments/settle'

/** Alipay's async notification (`notify_url`): a POST of form-encoded params, unlike
 *  the epay aggregator's GET. Alipay retries for ~24h until the body is exactly
 *  "success", so every other path here must answer something else — otherwise a
 *  genuinely unsettled payment would look acknowledged and never be retried. */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null)
  if (!form) return new Response('fail', { status: 400 })

  const params: Record<string, string> = {}
  for (const [key, value] of form.entries()) {
    if (typeof value === 'string') params[key] = value
  }

  let result
  try {
    result = getProviderByName('alipay').verifyCallback(params)
  } catch {
    return new Response('fail', { status: 500 })
  }

  if (!result) return new Response('fail', { status: 400 })

  const supabase = await createServiceClient()
  const outcome = await markOrderPaid(supabase, 'alipay', result)

  // A retried notification for an order already settled is a success, not a failure —
  // answering "fail" there would keep Alipay retrying a payment that is fully handled.
  if (outcome === 'paid' || outcome === 'already_paid') return new Response('success')

  console.error('[alipay-callback]', outcome, result.outTradeNo, result.providerOrderId)
  return new Response('fail', { status: outcome === 'error' ? 500 : 400 })
}
