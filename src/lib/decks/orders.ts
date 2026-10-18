import type { SupabaseClient } from '@supabase/supabase-js'
import { getDeckPricing, hasPaidDeckOrder } from './access'
import { getPaymentProvider } from '@/lib/payments'
import {
  CHECKOUT_TIMEOUT_MINUTES,
  expireStalePendingOrders,
} from '@/lib/orders/expire'

/** Thrown for expected, user-facing failure modes (not for sale / already owned) so
 *  the API route can tell those apart from unexpected errors and answer with the
 *  right status code instead of a generic 500. */
export class DeckOrderError extends Error {}

export interface CreateDeckOrderResult {
  payUrl: string
  orderId: string
}

interface PendingOrderRow {
  id: string
  amount_cents: number
  currency: string
  provider: string | null
  created_at: string
}

/** One live checkout per user and deck: finding a fresh row lets a second click
 *  resume the same provider trade instead of minting another payable order. */
async function findPendingOrder(
  supabase: SupabaseClient,
  userId: string,
  slug: string
): Promise<PendingOrderRow | null> {
  const { data, error } = await supabase
    .from('ai_pulse_orders')
    .select('id, amount_cents, currency, provider, created_at')
    .eq('user_id', userId)
    .eq('kind', 'deck')
    .eq('ref', slug)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null

  return data as PendingOrderRow
}

function isReusable(
  pending: PendingOrderRow,
  priceCents: number,
  currency: string,
  providerName: string
): boolean {
  const age = Date.now() - new Date(pending.created_at).getTime()
  // Only reuse inside the channel's payment window. The extra grace period in
  // expire.ts belongs to callback delivery, not to a new checkout: past 30 minutes
  // Alipay has already closed the trade and its page is no longer payable.
  if (!Number.isFinite(age) || age > CHECKOUT_TIMEOUT_MINUTES * 60 * 1000) return false

  return (
    pending.amount_cents === priceCents &&
    pending.currency === currency &&
    pending.provider === providerName
  )
}

async function cancelPendingOrder(
  supabase: SupabaseClient,
  orderId: string,
  reason: 'superseded' | 'error'
): Promise<void> {
  await supabase
    .from('ai_pulse_orders')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancel_reason: reason,
    })
    .eq('id', orderId)
    .eq('status', 'pending')
}

/** Starts a purchase: creates a `pending` ai_pulse_orders row, then asks the
 *  configured payment provider for a checkout URL keyed to that row's id
 *  (out_trade_no). The row only ever flips to `paid` from the provider's callback
 *  (or a signed status query, via src/lib/payments/sync.ts) — never from here. A
 *  browser abandoning checkout leaves a row that expires after the checkout window.
 *  Repeating the click while that window is open reuses the same order. */
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

  // Clear yesterday's abandoned checkouts first so the unique pending index only
  // ever has to arbitrate genuinely concurrent clicks.
  await expireStalePendingOrders(supabase, userId)

  const existing = await findPendingOrder(supabase, userId, slug)
  const reusable = existing && isReusable(existing, pricing.priceCents, pricing.currency, provider.name)

  if (existing && !reusable) {
    // Past the channel's payment window, or no longer the same price/channel: retire
    // it now so it cannot block the new row or be presented as payable.
    await cancelPendingOrder(supabase, existing.id, 'superseded')
  }

  let orderId = reusable && existing ? existing.id : null
  let created = false

  if (!orderId) {
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

    if (error?.code === '23505') {
      // Another tab won the insert race; its order is the one to pay.
      const raced = await findPendingOrder(supabase, userId, slug)
      if (!raced || !isReusable(raced, pricing.priceCents, pricing.currency, provider.name)) {
        throw new DeckOrderError('Failed to create order: concurrent checkout')
      }
      orderId = raced.id
    } else if (error || !order) {
      throw new DeckOrderError(`Failed to create order: ${error?.message ?? 'unknown error'}`)
    } else {
      orderId = order.id as string
      created = true
    }
  }

  if (!orderId) throw new DeckOrderError('Failed to create order')

  try {
    const { payUrl } = await provider.createOrder({
      outTradeNo: orderId,
      amountCents: pricing.priceCents,
      title: pricing.title,
      method,
      // Callback routes are named after the provider, so the channel that gets called
      // back is always the one that was charged.
      notifyUrl: `${origin}/api/orders/callback/${provider.name}`,
      // The return route syncs the order before sending the browser back to /decks.
      returnUrl: `${origin}/api/orders/return?order=${orderId}`,
      timeoutMinutes: CHECKOUT_TIMEOUT_MINUTES,
    })

    return { payUrl, orderId }
  } catch (err) {
    // Nothing was handed to the browser, so this row would only be dashboard noise.
    if (created) await cancelPendingOrder(supabase, orderId, 'error')
    throw err
  }
}
