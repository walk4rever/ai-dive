import type { SupabaseClient } from '@supabase/supabase-js'

export interface OverviewTrend {
  label: string
  /** Count in the last 7 days. */
  current: number
  /** Count in the 7 days before that — the baseline `current` is compared against. */
  previous: number
  /** Formatted supplementary value, e.g. GMV for the purchases trend. Omitted when
   *  the metric is a plain count. */
  detail?: string
}

interface DateRow {
  createdAt: string | null
}

function countInWindow(rows: DateRow[], from: Date, to: Date): number {
  return rows.filter((row) => {
    if (!row.createdAt) return false
    const t = new Date(row.createdAt).getTime()
    return t >= from.getTime() && t < to.getTime()
  }).length
}

/** Registrations, newsletter subscriptions, and paid-deck purchases over the last 7
 *  days vs. the 7 days before — the "is the site actually moving" counterpart to the
 *  static totals in the stat tiles above. All three tables are small enough today to
 *  pull id + one date column and count in JS rather than pushing the window math into
 *  SQL; revisit if any of them grow past a few thousand rows. */
export async function fetchAdminOverviewTrends(supabase: SupabaseClient): Promise<OverviewTrend[]> {
  const now = new Date()
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  const [{ data: users }, { data: subscribers }, { data: orders }] = await Promise.all([
    supabase.from('ai_pulse_users').select('created_at'),
    supabase.from('ai_pulse_subscribers').select('subscribed_at'),
    supabase.from('ai_pulse_orders').select('amount_cents, currency, paid_at').eq('status', 'paid'),
  ])

  const userRows: DateRow[] = (users ?? []).map((r) => ({ createdAt: r.created_at as string | null }))
  const subscriberRows: DateRow[] = (subscribers ?? []).map((r) => ({ createdAt: r.subscribed_at as string | null }))
  const orderRows = (orders ?? []) as { amount_cents: number; currency: string; paid_at: string | null }[]

  const currentOrders = orderRows.filter((row) => {
    if (!row.paid_at) return false
    const t = new Date(row.paid_at).getTime()
    return t >= oneWeekAgo.getTime() && t < now.getTime()
  })
  const gmvCents = currentOrders.reduce((sum, row) => sum + row.amount_cents, 0)
  const gmvCurrency = currentOrders[0]?.currency ?? 'CNY'
  const gmvLabel = gmvCurrency === 'CNY' ? `¥${(gmvCents / 100).toFixed(2)}` : `${gmvCurrency} ${(gmvCents / 100).toFixed(2)}`

  return [
    {
      label: '新增注册',
      current: countInWindow(userRows, oneWeekAgo, now),
      previous: countInWindow(userRows, twoWeeksAgo, oneWeekAgo),
    },
    {
      label: '新增订阅',
      current: countInWindow(subscriberRows, oneWeekAgo, now),
      previous: countInWindow(subscriberRows, twoWeeksAgo, oneWeekAgo),
    },
    {
      label: '成交订单',
      current: currentOrders.length,
      previous: countInWindow(
        orderRows.map((r) => ({ createdAt: r.paid_at })),
        twoWeeksAgo,
        oneWeekAgo
      ),
      detail: gmvLabel,
    },
  ]
}
