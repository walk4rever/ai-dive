import { describe, expect, it } from 'vitest'
import {
  FREE_MONTHLY_CREDITS,
  HOURLY_SPEND_LIMIT,
  currentPeriod,
  ensureFreeGrant,
  getBalance,
  recordSpend,
  withinHourlyLimit,
} from './credits'

interface FakeResult {
  data?: unknown
  error?: { code?: string; message: string } | null
  count?: number | null
}

/** Minimal stand-in for a supabase-js query builder: every chain method returns the
 *  same object, and the object itself resolves like the real builder does when awaited
 *  directly (it implements PromiseLike via `then`). */
function fakeSupabase(result: FakeResult) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    or: () => builder,
    gte: () => builder,
    insert: () => builder,
    then: (resolve: (value: FakeResult) => void) => resolve(result),
  }
  return { from: () => builder } as unknown as Parameters<typeof getBalance>[0]
}

describe('currentPeriod', () => {
  it('formats as YYYY-MM in UTC', () => {
    expect(currentPeriod(new Date('2026-08-27T12:00:00Z'))).toBe('2026-08')
    expect(currentPeriod(new Date('2026-01-05T00:00:00Z'))).toBe('2026-01')
  })
})

describe('getBalance', () => {
  it('sums delta across returned rows', async () => {
    const supabase = fakeSupabase({ data: [{ delta: 100 }, { delta: -1 }, { delta: -1 }], error: null })
    await expect(getBalance(supabase, 'user-1')).resolves.toBe(98)
  })

  it('returns 0 on query error rather than throwing', async () => {
    const supabase = fakeSupabase({ data: null, error: { message: 'boom' } })
    await expect(getBalance(supabase, 'user-1')).resolves.toBe(0)
  })
})

describe('ensureFreeGrant', () => {
  it('resolves on a clean insert', async () => {
    const supabase = fakeSupabase({ error: null })
    await expect(ensureFreeGrant(supabase, 'user-1')).resolves.toBeUndefined()
  })

  it('swallows a unique-violation (already granted this period) instead of throwing', async () => {
    const supabase = fakeSupabase({ error: { code: '23505', message: 'duplicate key' } })
    await expect(ensureFreeGrant(supabase, 'user-1')).resolves.toBeUndefined()
  })

  it('throws on any other insert error', async () => {
    const supabase = fakeSupabase({ error: { code: '500', message: 'boom' } })
    await expect(ensureFreeGrant(supabase, 'user-1')).rejects.toThrow('boom')
  })
})

describe('recordSpend', () => {
  it('resolves on a clean insert', async () => {
    const supabase = fakeSupabase({ error: null })
    await expect(recordSpend(supabase, 'user-1')).resolves.toBeUndefined()
  })

  it('throws on insert error', async () => {
    const supabase = fakeSupabase({ error: { message: 'boom' } })
    await expect(recordSpend(supabase, 'user-1')).rejects.toThrow('boom')
  })
})

describe('withinHourlyLimit', () => {
  it('is true when under the ceiling', async () => {
    const supabase = fakeSupabase({ count: HOURLY_SPEND_LIMIT - 1, error: null })
    await expect(withinHourlyLimit(supabase, 'user-1')).resolves.toBe(true)
  })

  it('is false at or above the ceiling', async () => {
    const supabase = fakeSupabase({ count: HOURLY_SPEND_LIMIT, error: null })
    await expect(withinHourlyLimit(supabase, 'user-1')).resolves.toBe(false)
  })

  it('fails open (true) on query error', async () => {
    const supabase = fakeSupabase({ count: null, error: { message: 'boom' } })
    await expect(withinHourlyLimit(supabase, 'user-1')).resolves.toBe(true)
  })
})

describe('FREE_MONTHLY_CREDITS', () => {
  it('is a positive integer', () => {
    expect(Number.isInteger(FREE_MONTHLY_CREDITS)).toBe(true)
    expect(FREE_MONTHLY_CREDITS).toBeGreaterThan(0)
  })
})
