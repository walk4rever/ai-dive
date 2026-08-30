import type { SupabaseClient } from '@supabase/supabase-js'
import { getDeckPricing, hasPaidDeckOrder } from './access'
import { getPaymentProvider } from '@/lib/payments'

/** Thrown for expected, user-facing failure modes (not for sale / already owned) so
 *  the API route can tell those apart from unexpected errors and answer with the
 *  right status code instead of a generic 500. */
export class DeckOrderError extends Error {}

export interface CreateDeckOrderResult {
  payUrl: string
}

/** Starts a purchase: creates a `pending` ai_pulse_orders row, then asks the
 *  configured payment provider for a checkout URL keyed to that row's id
 *  (out_trade_no). The row only ever flips to `paid` from the provider's callback
 *  (src/app/api/orders/callback/[provider]) — never from here — so a browser
 *  abandoning checkout just leaves an inert pending row behind. */
export async function createDeckOrder(
  supabase: SupabaseClient,
  userId: string,
  email: string,
  slug: string,
  method: 'alipay' | 'wechat',
  /** Public origin of this deployment, e.g. https://ai.air7.fun — the provider has to
   *  be able to reach the notify URL built from it, so a tunnel/preview origin will
   *  get a checkout page but never a callback. */
  origin: string
): Promise<CreateDeckOrderResult> {
  const pricing = await getDeckPricing(supabase, slug)
  if (!pricing || pricing.priceCents === null) {
    throw new DeckOrderError('This deck is not for sale')
  }

  if (await hasPaidDeckOrder(supabase, userId, slug)) {
    throw new DeckOrderError('Already purchased')
  }

  const provider = getPaymentProvider(method)

  const { data: order, error } = await supabase
    .from('ai_pulse_orders')
    .insert({
      user_id: userId,
      email,
      kind: 'deck',
      ref: slug,
      amount_cents: pricing.priceCents,
      currency: pricing.currency,
      provider: provider.name,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error || !order) {
    throw new DeckOrderError(`Failed to create order: ${error?.message ?? 'unknown error'}`)
  }

  const { payUrl } = await provider.createOrder({
    outTradeNo: order.id as string,
    amountCents: pricing.priceCents,
    title: pricing.title,
    method,
    // Callback routes are named after the provider, so the channel that gets called
    // back is always the one that was charged.
    notifyUrl: `${origin}/api/orders/callback/${provider.name}`,
    returnUrl: `${origin}/decks`,
  })

  return { payUrl }
}
