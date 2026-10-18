import type { SupabaseClient } from '@supabase/supabase-js'
import type { CallbackResult } from './types'

/** Why an outcome, not a boolean: a provider retries its callback until it sees an
 *  acknowledgement, so "already paid" (a retry — acknowledge it) must be told apart
 *  from "amount mismatch" (never acknowledge; it needs a human). */
export type SettleOutcome =
  | 'paid'
  | 'already_paid'
  | 'unknown_order'
  | 'amount_mismatch'
  | 'not_payable'
  | 'error'

/** Marks the order named by a *verified* callback as paid. Callers must have
 *  signature-checked the callback first — this trusts its contents. */
export async function markOrderPaid(
  supabase: SupabaseClient,
  provider: string,
  result: CallbackResult
): Promise<SettleOutcome> {
  const { data: order, error } = await supabase
    .from('ai_pulse_orders')
    .select('id, user_id, kind, ref, amount_cents, status')
    .eq('id', result.outTradeNo)
    .maybeSingle()

  if (error) return 'error'
  if (!order) return 'unknown_order'
  if (order.status === 'paid') return 'already_paid'
  if (order.status === 'refunded') return 'not_payable'

  // A valid signature proves the provider sent the amount, not that it is the amount
  // we asked for — a checkout tampered with before payment would otherwise unlock
  // the deck for less than its price.
  if (order.amount_cents !== result.amountCents) return 'amount_mismatch'

  const now = new Date().toISOString()

  // A cancelled row is still payable at the channel when a late callback arrives
  // (the cashier was open before the local expiry). Money received is the source of
  // truth: reopen the row instead of acknowledging a payment we never recorded.
  // The status guard also keeps two concurrent callback deliveries from both winning.
  const { data: updated, error: updateError } = await supabase
    .from('ai_pulse_orders')
    .update({
      status: 'paid',
      paid_at: now,
      provider,
      provider_order_id: result.providerOrderId,
      cancelled_at: null,
      cancel_reason: null,
    })
    .eq('id', result.outTradeNo)
    .in('status', ['pending', 'cancelled'])
    .select('id')

  if (updateError) {
    // Legacy data can already contain a different paid row for the same purchase.
    // That order still grants access; retire this duplicate instead of making the
    // provider retry a callback that can never succeed.
    if (updateError.code === '23505') {
      await supabase
        .from('ai_pulse_orders')
        .update({
          status: 'cancelled',
          cancelled_at: now,
          cancel_reason: 'superseded',
        })
        .eq('id', order.id)
        .in('status', ['pending', 'cancelled'])
      return 'already_paid'
    }
    return 'error'
  }
  if (!updated || updated.length === 0) {
    // A concurrent delivery may have settled it between our read and update.
    const { data: current, error: rereadError } = await supabase
      .from('ai_pulse_orders')
      .select('status')
      .eq('id', result.outTradeNo)
      .maybeSingle()

    if (rereadError) return 'error'
    return current?.status === 'paid' ? 'already_paid' : 'error'
  }

  // The purchase is settled, so any sibling checkout for the same item is dead.
  // Best effort: a failure here must not turn a successful payment into a retry.
  await supabase
    .from('ai_pulse_orders')
    .update({
      status: 'cancelled',
      cancelled_at: now,
      cancel_reason: 'superseded',
    })
    .eq('user_id', order.user_id)
    .eq('kind', order.kind)
    .eq('ref', order.ref)
    .eq('status', 'pending')
    .neq('id', order.id)

  return 'paid'
}
