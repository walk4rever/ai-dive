import type { SupabaseClient } from '@supabase/supabase-js'
import { currentPeriod } from '@/lib/credits'

export interface AdminUser {
  id: string
  email: string
  username: string | null
  role: 'user' | 'admin'
  email_verified_at: string | null
  created_at: string
  /** Current-period credit balance — same SUM(delta) rule as getBalance() in
   *  src/lib/credits.ts, just computed once for every user in a single query instead
   *  of one query per row. A user who hasn't been lazily granted yet this period
   *  (never visited /agent or /dashboard) reads 0 here, same as it would on their own
   *  dashboard before their first visit of the month — this list doesn't trigger the
   *  grant itself, it's read-only. */
  creditsBalance: number
  /** Count of ai_pulse_orders rows with kind='deck', any status — a quick "has this
   *  person bought anything" signal, not a full order history (that's P2 scope). */
  deckOrderCount: number
}

interface LedgerRow {
  user_id: string
  delta: number
}

interface OrderRow {
  user_id: string
}

export async function fetchAdminUsers(supabase: SupabaseClient): Promise<AdminUser[]> {
  const period = currentPeriod()

  const [{ data: users }, { data: ledgerRows }, { data: orderRows }] = await Promise.all([
    supabase
      .from('ai_pulse_users')
      .select('id, email, username, role, email_verified_at, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('ai_pulse_credit_ledger')
      .select('user_id, delta')
      .or(`period.eq.${period},period.is.null`),
    supabase.from('ai_pulse_orders').select('user_id').eq('kind', 'deck'),
  ])

  if (!users) return []

  const balanceByUser = new Map<string, number>()
  for (const row of (ledgerRows ?? []) as LedgerRow[]) {
    balanceByUser.set(row.user_id, (balanceByUser.get(row.user_id) ?? 0) + row.delta)
  }

  const orderCountByUser = new Map<string, number>()
  for (const row of (orderRows ?? []) as OrderRow[]) {
    orderCountByUser.set(row.user_id, (orderCountByUser.get(row.user_id) ?? 0) + 1)
  }

  return users.map((user) => ({
    id: user.id as string,
    email: user.email as string,
    username: user.username as string | null,
    role: user.role as 'user' | 'admin',
    email_verified_at: user.email_verified_at as string | null,
    created_at: user.created_at as string,
    creditsBalance: balanceByUser.get(user.id as string) ?? 0,
    deckOrderCount: orderCountByUser.get(user.id as string) ?? 0,
  }))
}
