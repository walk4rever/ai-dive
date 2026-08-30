import type { SupabaseClient } from '@supabase/supabase-js'
import type { CallbackResult } from './types'

/** Why an outcome, not a boolean: a provider retries its callback until it sees an
 *  acknowledgement, so "already paid" (a retry — acknowledge it) must be told apart
 *  from "amount mismatch" (never acknowledge; it needs a human). */
export type SettleOutcome = 'paid' | 'already_paid' | 'unknown_order' | 'amount_mismatch' | 'error'

/** Marks the order named by a *verified* callback as paid. Callers must have
 *  signature-checked the callback first — this trusts its contents. */
export async function markOrderPaid(
  supabase: SupabaseClient,
  provider: string,
  result: CallbackResult
): Promise<SettleOutcome> {
  const { data: order, error } = await supabase
    .from('ai_pulse_orders')
    .select('id, amount_cents, status')
    .eq('id', result.outTradeNo)
    .maybeSingle()

  if (error) return 'error'
  if (!order) return 'unknown_order'
  if (order.status === 'paid') return 'already_paid'

  // A valid signature proves the provider sent the amount, not that it is the amount
  // we asked for — a checkout tampered with before payment would otherwise unlock
  // the deck for less than its price.
  if (order.amount_cents !== result.amountCents) return 'amount_mismatch'

  // Guarded by status='pending' so two concurrent callback deliveries can't both win.
  const { error: updateError } = await supabase
    .from('ai_pulse_orders')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      provider,
      provider_order_id: result.providerOrderId,
    })
    .eq('id', result.outTradeNo)
    .eq('status', 'pending')

  return updateError ? 'error' : 'paid'
}
