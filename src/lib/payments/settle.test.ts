import { beforeEach, describe, expect, it, vi } from 'vitest'
import { markOrderPaid } from './settle'

const result = { outTradeNo: 'order-1', providerOrderId: 'alipay-txn-1', amountCents: 1990 }

/** Minimal stand-in for the two queries markOrderPaid runs: a select of the order
 *  row, then a guarded update. `updates` records what the update was called with. */
function fakeSupabase(
  order: { id: string; amount_cents: number; status: string } | null,
  options: { selectError?: { message: string }; updateError?: { message: string } } = {}
) {
  const updates: Record<string, unknown>[] = []
  const eqChain = {
    eq: () => eqChain,
    then: (resolve: (v: { error: unknown }) => void) => resolve({ error: options.updateError ?? null }),
  }
  const supabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: order, error: options.selectError ?? null }),
        }),
      }),
      update: (row: Record<string, unknown>) => (updates.push(row), eqChain),
    }),
  }
  return { supabase: supabase as never, updates }
}

const pending = { id: 'order-1', amount_cents: 1990, status: 'pending' }

describe('markOrderPaid', () => {
  beforeEach(() => vi.clearAllMocks())

  it('marks a matching pending order paid and stamps the channel and its txn id', async () => {
    const { supabase, updates } = fakeSupabase(pending)

    await expect(markOrderPaid(supabase, 'alipay', result)).resolves.toBe('paid')
    expect(updates[0]).toMatchObject({
      status: 'paid',
      provider: 'alipay',
      provider_order_id: 'alipay-txn-1',
    })
    expect(updates[0].paid_at).toEqual(expect.any(String))
  })

  it('reports a retried callback for an already-paid order without updating again', async () => {
    const { supabase, updates } = fakeSupabase({ ...pending, status: 'paid' })

    await expect(markOrderPaid(supabase, 'alipay', result)).resolves.toBe('already_paid')
    expect(updates).toHaveLength(0)
  })

  it('refuses to settle when the paid amount is not the price we asked for', async () => {
    const { supabase, updates } = fakeSupabase({ ...pending, amount_cents: 9900 })

    await expect(markOrderPaid(supabase, 'alipay', result)).resolves.toBe('amount_mismatch')
    expect(updates).toHaveLength(0)
  })

  it('reports an out_trade_no that matches no order', async () => {
    const { supabase } = fakeSupabase(null)
    await expect(markOrderPaid(supabase, 'alipay', result)).resolves.toBe('unknown_order')
  })

  it('reports a failed lookup as an error rather than a silent no-op', async () => {
    const { supabase } = fakeSupabase(null, { selectError: { message: 'db down' } })
    await expect(markOrderPaid(supabase, 'alipay', result)).resolves.toBe('error')
  })

  it('reports a failed update as an error', async () => {
    const { supabase } = fakeSupabase(pending, { updateError: { message: 'db down' } })
    await expect(markOrderPaid(supabase, 'alipay', result)).resolves.toBe('error')
  })
})
