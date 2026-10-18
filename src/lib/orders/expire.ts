import type { SupabaseClient } from '@supabase/supabase-js'

/** The channel closes the trade at 30 minutes; the extra 10 minutes keep a payment
 *  made right at the deadline from being cancelled before its callback arrives. */
export const CHECKOUT_TIMEOUT_MINUTES = 30
export const PENDING_ORDER_GRACE_MINUTES = 10
export const PENDING_ORDER_TTL_MS =
  (CHECKOUT_TIMEOUT_MINUTES + PENDING_ORDER_GRACE_MINUTES) * 60 * 1000

export function pendingCutoff(now = new Date()): string {
  return new Date(now.getTime() - PENDING_ORDER_TTL_MS).toISOString()
}

/** Cancels pending rows older than the checkout window. A missing user id sweeps
 *  every user, which is what the daily cron does; the dashboard passes one user so
 *  stale rows disappear before the list renders. */
export async function expireStalePendingOrders(
  supabase: SupabaseClient,
  userId?: string
): Promise<boolean> {
  let query = supabase
    .from('ai_pulse_orders')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancel_reason: 'expired',
    })
    .eq('status', 'pending')
    .lt('created_at', pendingCutoff())

  if (userId) query = query.eq('user_id', userId)

  const { error } = await query
  return !error
}
