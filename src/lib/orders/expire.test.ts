import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PENDING_ORDER_TTL_MS,
  expireStalePendingOrders,
} from './expire'

function fakeSupabase(result: { error: { message: string } | null } = { error: null }) {
  const patches: Record<string, unknown>[] = []
  const filters: [string, unknown][] = []

  const chain = {
    eq: (column: string, value: unknown) => {
      filters.push([column, value])
      return chain
    },
    lt: (column: string, value: unknown) => {
      filters.push([column, value])
      return chain
    },
    then: (resolve: (value: typeof result) => void) => resolve(result),
  }

  const supabase = {
    from: () => ({
      update: (patch: Record<string, unknown>) => {
        patches.push(patch)
        return chain
      },
    }),
  }

  return { supabase: supabase as never, patches, filters }
}

describe('expireStalePendingOrders', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('cancels pending rows older than the checkout window for one user', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-18T08:00:00Z'))
    const { supabase, patches, filters } = fakeSupabase()

    await expect(expireStalePendingOrders(supabase, 'user-1')).resolves.toBe(true)

    expect(patches[0]).toMatchObject({
      status: 'cancelled',
      cancel_reason: 'expired',
    })
    expect(patches[0].cancelled_at).toEqual(expect.any(String))
    expect(filters).toContainEqual(['status', 'pending'])
    expect(filters).toContainEqual(['user_id', 'user-1'])
    expect(filters.find(([column]) => column === 'created_at')?.[1]).toEqual(
      '2026-10-18T07:20:00.000Z'
    )
  })

  it('sweeps every user when no user id is given', async () => {
    const { supabase, filters } = fakeSupabase()

    await expireStalePendingOrders(supabase)

    expect(filters.some(([column]) => column === 'user_id')).toBe(false)
  })

  it('reports a database failure instead of silently succeeding', async () => {
    const { supabase } = fakeSupabase({ error: { message: 'db down' } })

    await expect(expireStalePendingOrders(supabase)).resolves.toBe(false)
  })

  it('keeps a ten-minute grace period beyond the provider timeout', () => {
    expect(PENDING_ORDER_TTL_MS).toBe(40 * 60 * 1000)
  })
})
