import type { SupabaseClient } from '@supabase/supabase-js'

/** Monthly free grant, in credits. One credit = one agent turn (src/app/api/agent/route.ts
 *  is the only place a browser reaches an LLM, so metering there covers /agent and every
 *  AI解读 panel). Deliberately generous until real per-turn cost data is in — see
 *  TODO.md 阶段 4.1. */
export const FREE_MONTHLY_CREDITS = 1000

/** Ceiling on spend rows within a trailing hour, independent of the monthly balance.
 *  Credits are the economic model (how much per month); this is abuse prevention (how
 *  fast) — a user can legitimately have balance left and still hit this. */
export const HOURLY_SPEND_LIMIT = 50

const GRANT_FREE = 'grant_free'
const SPEND_AGENT = 'spend_agent'

/** 'YYYY-MM' in UTC — the period a ledger row belongs to. Rows outside the current
 *  period stop counting toward the balance query, which is what makes monthly expiry
 *  implicit and needs no cleanup job. */
export function currentPeriod(date: Date = new Date()): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

/** Balance = SUM(delta) over rows in the given period plus any never-expiring rows
 *  (period IS NULL, reserved for future purchased top-ups). Never stored/mutated in
 *  place — this table is append-only by design. */
export async function getBalance(
  supabase: SupabaseClient,
  userId: string,
  period: string = currentPeriod()
): Promise<number> {
  const { data, error } = await supabase
    .from('ai_pulse_credit_ledger')
    .select('delta')
    .eq('user_id', userId)
    .or(`period.eq.${period},period.is.null`)

  if (error || !data) return 0

  return data.reduce((sum: number, row: { delta: number }) => sum + row.delta, 0)
}

/** Lazily grants this period's free credits the first time a user is seen in it.
 *  Idempotent under concurrent requests via the partial unique index on
 *  (user_id, reason, period) — a duplicate insert hits that constraint and is
 *  swallowed here rather than surfaced, so callers never need to branch on "already
 *  granted". No cron: the grant only exists once someone actually shows up. */
export async function ensureFreeGrant(
  supabase: SupabaseClient,
  userId: string,
  period: string = currentPeriod()
): Promise<void> {
  const { error } = await supabase.from('ai_pulse_credit_ledger').insert({
    user_id: userId,
    delta: FREE_MONTHLY_CREDITS,
    reason: GRANT_FREE,
    period,
  })

  if (error && error.code !== '23505') {
    throw new Error(`Failed to grant free credits: ${error.message}`)
  }
}

/** Records one turn's spend. Called only after the gateway has confirmed it accepted
 *  the request (upstream.ok) — balance is checked up front instead of pre-deducting
 *  and refunding on failure, which keeps this the only ledger write per turn. */
export async function recordSpend(
  supabase: SupabaseClient,
  userId: string,
  refId?: string,
  period: string = currentPeriod()
): Promise<void> {
  const { error } = await supabase.from('ai_pulse_credit_ledger').insert({
    user_id: userId,
    delta: -1,
    reason: SPEND_AGENT,
    period,
    ref_id: refId ?? null,
  })

  if (error) {
    throw new Error(`Failed to record credit spend: ${error.message}`)
  }
}

/** True if the user is still under the trailing-hour spend ceiling. Reads existing
 *  spend_agent rows rather than writing a separate counter — no new table, no extra
 *  write per turn. */
export async function withinHourlyLimit(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const { count, error } = await supabase
    .from('ai_pulse_credit_ledger')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('reason', SPEND_AGENT)
    .gte('created_at', oneHourAgo)

  if (error || count === null) return true

  return count < HOURLY_SPEND_LIMIT
}
