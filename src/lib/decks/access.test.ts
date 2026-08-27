import { describe, expect, it } from 'vitest'
import { canAccessDeck, formatPrice, getDeckPricing, hasPaidDeckOrder } from './access'

interface FakeResult {
  data?: unknown
  error?: { message: string } | null
}

/** Minimal stand-in for a supabase-js query builder, keyed by table name so a single
 *  test can give different canned results to different `.from(...)` calls (needed for
 *  canAccessDeck, which queries both ai_pulse_decks and ai_pulse_orders). Every chain
 *  method returns the same builder; `.single()` and a direct `await` both resolve to
 *  the table's result, matching how the real client can end a chain either way. */
function fakeSupabase(byTable: Record<string, FakeResult>) {
  return {
    from: (table: string) => {
      const result = byTable[table] ?? { data: null, error: { message: `no mock for table "${table}"` } }
      const builder = {
        select: () => builder,
        eq: () => builder,
        limit: () => builder,
        single: async () => result,
        then: (resolve: (value: FakeResult) => void) => resolve(result),
      }
      return builder
    },
  } as unknown as Parameters<typeof getDeckPricing>[0]
}

describe('getDeckPricing', () => {
  it('returns priceCents and currency for a published deck', async () => {
    const supabase = fakeSupabase({
      ai_pulse_decks: { data: { price_cents: 1900, currency: 'CNY' }, error: null },
    })
    await expect(getDeckPricing(supabase, 'k3-course')).resolves.toEqual({ priceCents: 1900, currency: 'CNY' })
  })

  it('returns priceCents: null for a deck that is still free', async () => {
    const supabase = fakeSupabase({
      ai_pulse_decks: { data: { price_cents: null, currency: 'CNY' }, error: null },
    })
    await expect(getDeckPricing(supabase, 'agent-harness')).resolves.toEqual({ priceCents: null, currency: 'CNY' })
  })

  it('returns null when the deck does not resolve (missing or unpublished)', async () => {
    const supabase = fakeSupabase({ ai_pulse_decks: { data: null, error: { message: 'not found' } } })
    await expect(getDeckPricing(supabase, 'nope')).resolves.toBeNull()
  })
})

describe('hasPaidDeckOrder', () => {
  it('is true when a paid order row exists', async () => {
    const supabase = fakeSupabase({ ai_pulse_orders: { data: [{ id: 'order-1' }], error: null } })
    await expect(hasPaidDeckOrder(supabase, 'user-1', 'k3-course')).resolves.toBe(true)
  })

  it('is false when no paid order row exists', async () => {
    const supabase = fakeSupabase({ ai_pulse_orders: { data: [], error: null } })
    await expect(hasPaidDeckOrder(supabase, 'user-1', 'k3-course')).resolves.toBe(false)
  })

  it('fails closed (false) on query error', async () => {
    const supabase = fakeSupabase({ ai_pulse_orders: { data: null, error: { message: 'boom' } } })
    await expect(hasPaidDeckOrder(supabase, 'user-1', 'k3-course')).resolves.toBe(false)
  })
})

describe('canAccessDeck', () => {
  it('allows anyone (no session) when the deck has never been priced', async () => {
    const supabase = fakeSupabase({ ai_pulse_decks: { data: { price_cents: null, currency: 'CNY' }, error: null } })
    await expect(canAccessDeck(supabase, null, 'agent-harness')).resolves.toBe(true)
  })

  it('denies an anonymous request for a priced deck', async () => {
    const supabase = fakeSupabase({ ai_pulse_decks: { data: { price_cents: 1900, currency: 'CNY' }, error: null } })
    await expect(canAccessDeck(supabase, null, 'k3-course')).resolves.toBe(false)
  })

  it('denies a logged-in user with no paid order for a priced deck', async () => {
    const supabase = fakeSupabase({
      ai_pulse_decks: { data: { price_cents: 1900, currency: 'CNY' }, error: null },
      ai_pulse_orders: { data: [], error: null },
    })
    await expect(canAccessDeck(supabase, 'user-1', 'k3-course')).resolves.toBe(false)
  })

  it('allows a logged-in user with a paid order for a priced deck', async () => {
    const supabase = fakeSupabase({
      ai_pulse_decks: { data: { price_cents: 1900, currency: 'CNY' }, error: null },
      ai_pulse_orders: { data: [{ id: 'order-1' }], error: null },
    })
    await expect(canAccessDeck(supabase, 'user-1', 'k3-course')).resolves.toBe(true)
  })

  it('denies access to an unknown slug', async () => {
    const supabase = fakeSupabase({ ai_pulse_decks: { data: null, error: { message: 'not found' } } })
    await expect(canAccessDeck(supabase, 'user-1', 'nope')).resolves.toBe(false)
  })
})

describe('formatPrice', () => {
  it('formats whole yuan without decimals', () => {
    expect(formatPrice(1900, 'CNY')).toBe('¥19')
  })

  it('formats fractional yuan with two decimals', () => {
    expect(formatPrice(1950, 'CNY')).toBe('¥19.50')
  })

  it('falls back to a labeled amount for non-CNY currencies', () => {
    expect(formatPrice(500, 'USD')).toBe('USD 5')
  })
})
