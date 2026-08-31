import type { SupabaseClient } from '@supabase/supabase-js'

export interface AdminSubscriber {
  id: string
  email: string
  name: string | null
  tier: 'free' | 'paid'
  status: 'pending' | 'active' | 'unsubscribed'
  subscribed_at: string
  confirmed_at: string | null
  unsubscribed_at: string | null
}

/** Read-only — this module has no write actions (no admin-triggered unsubscribe/edit),
 *  just visibility into who's on the list. Newest first, same ordering as every other
 *  admin list in this codebase. */
export async function fetchAdminSubscribers(supabase: SupabaseClient): Promise<AdminSubscriber[]> {
  const { data, error } = await supabase
    .from('ai_pulse_subscribers')
    .select('id, email, name, tier, status, subscribed_at, confirmed_at, unsubscribed_at')
    .order('subscribed_at', { ascending: false })

  if (error || !data) return []

  return data as AdminSubscriber[]
}
