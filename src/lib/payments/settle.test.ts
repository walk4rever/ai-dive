import { describe, expect, it } from 'vitest'
import { markOrderPaid } from './settle'

const result = { outTradeNo: 'order-1', providerOrderId: 'alipay-txn-1', amountCents: 1990 }

interface FakeOptions {
  selectError?: { message: string }
  updateError?: { message: string; code?: string }
  updatedRows?: number
  rereadStatus?: string
}

/** Stands in for the reads and guarded updates markOrderPaid performs: load the
 *  row, update it with a status filter and select, then cancel sibling checkouts. */
function fakeSupabase(
  order: {
    id: string
    user_id: string
    kind: string
    ref: string
    amount_cents: number
    status: string
  } | null,
  options: FakeOptions = {}
) {
  const updates: Record<string, unknown>[] = []

  const supabase = {
    from: () => ({
      select: (columns: string) => {
        const builder = {
          eq: () => builder,
          maybeSingle: async () => {
            if (columns === 'status') {
              return { data: { status: options.rereadStatus ?? 'paid' }, error: null }
            }
            return { data: order, error: options.selectError ?? null }
          },
        }
        return builder
      },
      update: (row: Record<string, unknown>) => {
        updates.push(row)
        const chain = {
          eq: () => chain,
          in: () => chain,
          neq: () => chain,
          select: async () => ({
            data: options.updatedRows === 0 ? [] : [{ id: 'order-1' }],
            error: options.updateError ?? null,
          }),
          then: (resolve: (value: { error: unknown }) => void) =>
            resolve({ error: options.updateError ?? null }),
        }
        return chain
      },
    }),
  }

  return { supabase: supabase as never, updates }
}

const pending = {
  id: 'order-1',
  user_id: 'user-1',
  kind: 'deck',
  ref: 'k3-course',
  amount_cents: 1990,
  status: 'pending',
}

describe('markOrderPaid', () => {
  it('marks a matching pending order paid and stamps the channel and its txn id', async () => {
    const { supabase, updates } = fakeSupabase(pending)

    await expect(markOrderPaid(supabase, 'alipay', result)).resolves.toBe('paid')
    expect(updates[0]).toMatchObject({
      status: 'paid',
      provider: 'alipay',
      provider_order_id: 'alipay-txn-1',
      cancelled_at: null,
      cancel_reason: null,
    })
    expect(updates[0].paid_at).toEqual(expect.any(String))
  })

  it('reopens a cancelled order when a late payment callback arrives', async () => {
    const { supabase, updates } = fakeSupabase({ ...pending, status: 'cancelled' })

    await expect(markOrderPaid(supabase, 'alipay', result)).resolves.toBe('paid')
    expect(updates[0]).toMatchObject({ status: 'paid', cancel_reason: null })
  })

  it('retires sibling pending checkouts for the same purchase', async () => {
    const { supabase, updates } = fakeSupabase(pending)

    await markOrderPaid(supabase, 'alipay', result)

    expect(updates[1]).toMatchObject({
      status: 'cancelled',
      cancel_reason: 'superseded',
    })
  })

  it('reports a retried callback for an already-paid order without updating again', async () => {
    const { supabase, updates } = fakeSupabase({ ...pending, status: 'paid' })

    await expect(markOrderPaid(supabase, 'alipay', result)).resolves.toBe('already_paid')
    expect(updates).toHaveLength(0)
  })

  it('refuses to settle a refunded order again', async () => {
    const { supabase, updates } = fakeSupabase({ ...pending, status: 'refunded' })

    await expect(markOrderPaid(supabase, 'alipay', result)).resolves.toBe('not_payable')
    expect(updates).toHaveLength(0)
  })

  it('refuses to settle when the paid amount is not the price we asked for', async () => {
    const { supabase, updates } = fakeSupabase({ ...pending, amount_cents: 9900 })

    await expect(markOrderPaid(supabase, 'alipay', result)).resolves.toBe('amount_mismatch')
    expect(updates).toHaveLength(0)
  })

  it('treats a no-op update as a concurrent settlement, not a fresh payment', async () => {
    const { supabase } = fakeSupabase(pending, { updatedRows: 0, rereadStatus: 'paid' })

    await expect(markOrderPaid(supabase, 'alipay', result)).resolves.toBe('already_paid')
  })

  it('reports a no-op update with an unexpected status as an error', async () => {
    const { supabase } = fakeSupabase(pending, { updatedRows: 0, rereadStatus: 'pending' })

    await expect(markOrderPaid(supabase, 'alipay', result)).resolves.toBe('error')
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

  it('treats a duplicate paid row as an existing entitlement', async () => {
    const { supabase } = fakeSupabase(pending, {
      updateError: { message: 'duplicate key', code: '23505' },
    })
    await expect(markOrderPaid(supabase, 'alipay', result)).resolves.toBe('already_paid')
  })
})
