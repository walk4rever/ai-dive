import type { SupabaseClient } from '@supabase/supabase-js'
import { getProviderByName } from './index'
import { markOrderPaid, type SettleOutcome } from './settle'

/** Reconciles one order against its payment channel. Used when the browser comes
 *  back from the cashier, because the async notification can lag behind the user.
 *  Cancelled rows are included: paying at the very edge of the timeout is a real
 *  success, and markOrderPaid() reopens them after the amount check. */
export async function syncOrderForUser(
  supabase: SupabaseClient,
  userId: string,
  orderId: string
): Promise<SettleOutcome | null> {
  const { data, error } = await supabase
    .from('ai_pulse_orders')
    .select('id, provider, status')
    .eq('id', orderId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) return null
  if (data.status === 'paid' || data.status === 'refunded') return null
  if (!data.provider) return null

  const provider = getProviderByName(data.provider)
  const result = await provider.queryStatus(data.id as string)
  if (!result) return null

  return markOrderPaid(supabase, provider.name, result)
}

/** Dashboard fallback for the common "closed the cashier and never came back" case.
 *  Bounded to three recent rows so a stale account cannot turn the console into a
 *  burst of gateway requests. */
export async function syncRecentPendingOrders(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('ai_pulse_orders')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(3)

  if (error || !data) return

  // Bounded to three rows above, so a parallel pass keeps the dashboard responsive
  // even when the gateway is slow; a failure cannot take the page down.
  await Promise.allSettled(
    (data as { id: string }[]).map((row) => syncOrderForUser(supabase, userId, row.id))
  )
}
