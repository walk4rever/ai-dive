import { describe, expect, it } from 'vitest'
import { listUserOrders } from './list'

interface FakeResult {
  data?: unknown
  error?: { message: string } | null
}

/** Same shape as the fake in src/lib/decks/access.test.ts: one canned result per
 *  table, every chain method returning the builder, awaiting it resolving to that
 *  result. listUserOrders reads two tables, so keying by table is what makes it
 *  testable without a live database. */
function fakeSupabase(byTable: Record<string, FakeResult>) {
  return {
    from: (table: string) => {
      const result = byTable[table] ?? { data: null, error: { message: `no mock for table "${table}"` } }
      const builder = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        order: () => builder,
        then: (resolve: (value: FakeResult) => void) => resolve(result),
      }
      return builder
    },
  } as unknown as Parameters<typeof listUserOrders>[0]
}

const paidOrder = {
  id: 'order-1',
  kind: 'deck',
  ref: 'k3-course',
  amount_cents: 1900,
  currency: 'CNY',
  status: 'paid',
  created_at: '2026-08-27T00:00:00Z',
  paid_at: '2026-08-27T00:01:00Z',
}

describe('listUserOrders', () => {
  it('resolves a deck order to the deck title and href', async () => {
    const supabase = fakeSupabase({
      ai_pulse_orders: { data: [paidOrder], error: null },
      ai_pulse_decks: { data: [{ slug: 'k3-course', title: 'K3 课程', href: '/decks/k3-course/' }], error: null },
    })
    await expect(listUserOrders(supabase, 'user-1')).resolves.toEqual([
      {
        id: 'order-1',
        title: 'K3 课程',
        href: '/decks/k3-course/',
        amountCents: 1900,
        currency: 'CNY',
        status: 'paid',
        createdAt: '2026-08-27T00:00:00Z',
        paidAt: '2026-08-27T00:01:00Z',
      },
    ])
  })

  it('falls back to the raw ref when the deck no longer resolves', async () => {
    const supabase = fakeSupabase({
      ai_pulse_orders: { data: [paidOrder], error: null },
      ai_pulse_decks: { data: [], error: null },
    })
    const [order] = await listUserOrders(supabase, 'user-1')
    expect(order.title).toBe('k3-course')
    expect(order.href).toBeNull()
  })

  it('gives an unpaid order no href, even when the deck resolves', async () => {
    const supabase = fakeSupabase({
      ai_pulse_orders: { data: [{ ...paidOrder, status: 'pending', paid_at: null }], error: null },
      ai_pulse_decks: { data: [{ slug: 'k3-course', title: 'K3 课程', href: '/decks/k3-course/' }], error: null },
    })
    const [order] = await listUserOrders(supabase, 'user-1')
    expect(order.status).toBe('pending')
    expect(order.href).toBeNull()
  })

  it('returns an empty list on query error', async () => {
    const supabase = fakeSupabase({ ai_pulse_orders: { data: null, error: { message: 'boom' } } })
    await expect(listUserOrders(supabase, 'user-1')).resolves.toEqual([])
  })

  it('skips the deck lookup entirely when there are no orders', async () => {
    const supabase = fakeSupabase({ ai_pulse_orders: { data: [], error: null } })
    await expect(listUserOrders(supabase, 'user-1')).resolves.toEqual([])
  })
})
