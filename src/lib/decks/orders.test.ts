import { beforeEach, describe, expect, it, vi } from 'vitest'

const getDeckPricing = vi.fn()
const hasPaidDeckOrder = vi.fn()
const getPaymentProvider = vi.fn()

vi.mock('./access', () => ({ getDeckPricing, hasPaidDeckOrder }))
vi.mock('@/lib/payments', () => ({ getPaymentProvider }))

function fakeSupabase(insertResult: { data?: unknown; error?: { message: string } | null }) {
  return {
    from: () => ({
      insert: () => ({
        select: () => ({
          single: async () => insertResult,
        }),
      }),
    }),
  } as unknown as Parameters<typeof import('./orders').createDeckOrder>[0]
}

describe('createDeckOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('refuses a deck that has never been priced', async () => {
    const { createDeckOrder, DeckOrderError } = await import('./orders')
    getDeckPricing.mockResolvedValue({ title: 'Free Deck', priceCents: null, currency: 'CNY' })
    const supabase = fakeSupabase({ data: null, error: null })

    await expect(
      createDeckOrder(supabase, 'user-1', 'a@b.com', 'free-deck', 'alipay', 'https://x/notify', 'https://x/return')
    ).rejects.toThrow(DeckOrderError)
  })

  it('refuses a slug that does not resolve to a deck at all', async () => {
    const { createDeckOrder, DeckOrderError } = await import('./orders')
    getDeckPricing.mockResolvedValue(null)
    const supabase = fakeSupabase({ data: null, error: null })

    await expect(
      createDeckOrder(supabase, 'user-1', 'a@b.com', 'nope', 'alipay', 'https://x/notify', 'https://x/return')
    ).rejects.toThrow(DeckOrderError)
  })

  it('refuses a repeat purchase', async () => {
    const { createDeckOrder, DeckOrderError } = await import('./orders')
    getDeckPricing.mockResolvedValue({ title: 'K3', priceCents: 1900, currency: 'CNY' })
    hasPaidDeckOrder.mockResolvedValue(true)
    const supabase = fakeSupabase({ data: null, error: null })

    await expect(
      createDeckOrder(supabase, 'user-1', 'a@b.com', 'k3-course', 'alipay', 'https://x/notify', 'https://x/return')
    ).rejects.toThrow(DeckOrderError)
  })

  it('surfaces an insert failure as a DeckOrderError', async () => {
    const { createDeckOrder, DeckOrderError } = await import('./orders')
    getDeckPricing.mockResolvedValue({ title: 'K3', priceCents: 1900, currency: 'CNY' })
    hasPaidDeckOrder.mockResolvedValue(false)
    const supabase = fakeSupabase({ data: null, error: { message: 'insert failed' } })

    await expect(
      createDeckOrder(supabase, 'user-1', 'a@b.com', 'k3-course', 'alipay', 'https://x/notify', 'https://x/return')
    ).rejects.toThrow(DeckOrderError)
  })

  it('creates a pending order and hands the provider its id as out_trade_no', async () => {
    const { createDeckOrder } = await import('./orders')
    getDeckPricing.mockResolvedValue({ title: 'K3 七天课', priceCents: 1900, currency: 'CNY' })
    hasPaidDeckOrder.mockResolvedValue(false)
    const supabase = fakeSupabase({ data: { id: 'order-abc' }, error: null })

    const createOrder = vi.fn().mockResolvedValue({ payUrl: 'https://pay.example.com/submit.php?x=y' })
    getPaymentProvider.mockReturnValue({ createOrder })

    const result = await createDeckOrder(
      supabase,
      'user-1',
      'a@b.com',
      'k3-course',
      'alipay',
      'https://ai-dive.test/api/orders/callback/epay',
      'https://ai-dive.test/decks'
    )

    expect(result).toEqual({ payUrl: 'https://pay.example.com/submit.php?x=y' })
    expect(createOrder).toHaveBeenCalledWith({
      outTradeNo: 'order-abc',
      amountCents: 1900,
      title: 'K3 七天课',
      method: 'alipay',
      notifyUrl: 'https://ai-dive.test/api/orders/callback/epay',
      returnUrl: 'https://ai-dive.test/decks',
    })
  })
})
