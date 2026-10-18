import { beforeEach, describe, expect, it, vi } from 'vitest'

const getDeckPricing = vi.fn()
const hasPaidDeckOrder = vi.fn()
const getPaymentProvider = vi.fn()
const expireStalePendingOrders = vi.fn()

vi.mock('./access', () => ({ getDeckPricing, hasPaidDeckOrder }))
vi.mock('@/lib/payments', () => ({ getPaymentProvider }))
vi.mock('@/lib/orders/expire', () => ({
  expireStalePendingOrders,
  CHECKOUT_TIMEOUT_MINUTES: 30,
}))

const insertedRows: Record<string, unknown>[] = []
const updatedRows: Record<string, unknown>[] = []
let pendingRow: Record<string, unknown> | null = null
let insertResult: { data?: unknown; error?: { message: string; code?: string } | null } = {
  data: { id: 'order-new' },
  error: null,
}

function fakeSupabase() {
  const pendingBuilder = {
    eq: () => pendingBuilder,
    order: () => pendingBuilder,
    limit: () => pendingBuilder,
    maybeSingle: async () => ({ data: pendingRow, error: null }),
  }

  return {
    from: () => ({
      select: () => pendingBuilder,
      insert: (row: Record<string, unknown>) => {
        insertedRows.push(row)
        return { select: () => ({ single: async () => insertResult }) }
      },
      update: (row: Record<string, unknown>) => {
        updatedRows.push(row)
        const chain = {
          eq: () => chain,
          then: (resolve: (value: { error: unknown }) => void) => resolve({ error: null }),
        }
        return chain
      },
    }),
  } as unknown as Parameters<typeof import('./orders').createDeckOrder>[0]
}

const freshPending = {
  id: 'order-old',
  amount_cents: 1900,
  currency: 'CNY',
  provider: 'alipay',
  created_at: new Date().toISOString(),
}

describe('createDeckOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    insertedRows.length = 0
    updatedRows.length = 0
    pendingRow = null
    insertResult = { data: { id: 'order-new' }, error: null }
    expireStalePendingOrders.mockResolvedValue(true)
    getPaymentProvider.mockReturnValue({
      name: 'alipay',
      createOrder: vi.fn().mockResolvedValue({ payUrl: 'https://openapi.alipay.com/gateway.do?x=y' }),
    })
  })

  it('refuses a deck that has never been priced', async () => {
    const { createDeckOrder, DeckOrderError } = await import('./orders')
    getDeckPricing.mockResolvedValue({ title: 'Free Deck', priceCents: null, currency: 'CNY' })

    await expect(
      createDeckOrder(fakeSupabase(), 'user-1', 'a@b.com', 'free-deck', 'alipay', 'https://ai.air7.fun')
    ).rejects.toThrow(DeckOrderError)
  })

  it('refuses a slug that does not resolve to a deck at all', async () => {
    const { createDeckOrder, DeckOrderError } = await import('./orders')
    getDeckPricing.mockResolvedValue(null)

    await expect(
      createDeckOrder(fakeSupabase(), 'user-1', 'a@b.com', 'nope', 'alipay', 'https://ai.air7.fun')
    ).rejects.toThrow(DeckOrderError)
  })

  it('refuses a repeat purchase', async () => {
    const { createDeckOrder, DeckOrderError } = await import('./orders')
    getDeckPricing.mockResolvedValue({ title: 'K3', priceCents: 1900, currency: 'CNY' })
    hasPaidDeckOrder.mockResolvedValue(true)

    await expect(
      createDeckOrder(fakeSupabase(), 'user-1', 'a@b.com', 'k3-course', 'alipay', 'https://ai.air7.fun')
    ).rejects.toThrow(DeckOrderError)
  })

  it('surfaces an insert failure as a DeckOrderError', async () => {
    const { createDeckOrder, DeckOrderError } = await import('./orders')
    getDeckPricing.mockResolvedValue({ title: 'K3', priceCents: 1900, currency: 'CNY' })
    hasPaidDeckOrder.mockResolvedValue(false)
    insertResult = { data: null, error: { message: 'insert failed' } }

    await expect(
      createDeckOrder(fakeSupabase(), 'user-1', 'a@b.com', 'k3-course', 'alipay', 'https://ai.air7.fun')
    ).rejects.toThrow(DeckOrderError)
  })

  it('creates a pending order and hands the provider its id as out_trade_no', async () => {
    const { createDeckOrder } = await import('./orders')
    getDeckPricing.mockResolvedValue({ title: 'K3 七天课', priceCents: 1900, currency: 'CNY' })
    hasPaidDeckOrder.mockResolvedValue(false)

    const createOrder = vi.fn().mockResolvedValue({ payUrl: 'https://openapi.alipay.com/gateway.do?x=y' })
    getPaymentProvider.mockReturnValue({ name: 'alipay', createOrder })

    const result = await createDeckOrder(
      fakeSupabase(),
      'user-1',
      'a@b.com',
      'k3-course',
      'alipay',
      'https://ai.air7.fun'
    )

    expect(result).toEqual({
      payUrl: 'https://openapi.alipay.com/gateway.do?x=y',
      orderId: 'order-new',
    })
    expect(getPaymentProvider).toHaveBeenCalledWith('alipay')
    expect(expireStalePendingOrders).toHaveBeenCalledWith(expect.anything(), 'user-1')
    expect(createOrder).toHaveBeenCalledWith({
      outTradeNo: 'order-new',
      amountCents: 1900,
      title: 'K3 七天课',
      method: 'alipay',
      notifyUrl: 'https://ai.air7.fun/api/orders/callback/alipay',
      returnUrl: 'https://ai.air7.fun/api/orders/return?order=order-new',
      timeoutMinutes: 30,
    })
  })

  it('records which channel the order was created on, so its callback can be matched', async () => {
    const { createDeckOrder } = await import('./orders')
    getDeckPricing.mockResolvedValue({ title: 'K3', priceCents: 1900, currency: 'CNY' })
    hasPaidDeckOrder.mockResolvedValue(false)
    getPaymentProvider.mockReturnValue({
      name: 'epay',
      createOrder: vi.fn().mockResolvedValue({ payUrl: 'https://pay.example.com/submit.php' }),
    })

    await createDeckOrder(
      fakeSupabase(),
      'user-1',
      'a@b.com',
      'k3-course',
      'wechat',
      'https://ai.air7.fun'
    )

    expect(insertedRows[0]).toMatchObject({ provider: 'epay', status: 'pending', amount_cents: 1900 })
  })

  it('reuses a fresh pending order instead of minting a second payable one', async () => {
    const { createDeckOrder } = await import('./orders')
    getDeckPricing.mockResolvedValue({ title: 'K3', priceCents: 1900, currency: 'CNY' })
    hasPaidDeckOrder.mockResolvedValue(false)
    pendingRow = freshPending

    const createOrder = vi.fn().mockResolvedValue({ payUrl: 'https://pay.example.com/same' })
    getPaymentProvider.mockReturnValue({ name: 'alipay', createOrder })

    const result = await createDeckOrder(
      fakeSupabase(),
      'user-1',
      'a@b.com',
      'k3-course',
      'alipay',
      'https://ai.air7.fun'
    )

    expect(insertedRows).toHaveLength(0)
    expect(createOrder).toHaveBeenCalledWith(expect.objectContaining({ outTradeNo: 'order-old' }))
    expect(result.orderId).toBe('order-old')
  })

  it('retires a pending order whose price or channel no longer matches', async () => {
    const { createDeckOrder } = await import('./orders')
    getDeckPricing.mockResolvedValue({ title: 'K3', priceCents: 2900, currency: 'CNY' })
    hasPaidDeckOrder.mockResolvedValue(false)
    pendingRow = freshPending

    await createDeckOrder(
      fakeSupabase(),
      'user-1',
      'a@b.com',
      'k3-course',
      'alipay',
      'https://ai.air7.fun'
    )

    expect(updatedRows[0]).toMatchObject({ status: 'cancelled', cancel_reason: 'superseded' })
    expect(insertedRows).toHaveLength(1)
  })

  it('retires a pending order that is already past the channel payment window', async () => {
    const { createDeckOrder } = await import('./orders')
    getDeckPricing.mockResolvedValue({ title: 'K3', priceCents: 1900, currency: 'CNY' })
    hasPaidDeckOrder.mockResolvedValue(false)
    pendingRow = {
      ...freshPending,
      created_at: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    }

    await createDeckOrder(
      fakeSupabase(),
      'user-1',
      'a@b.com',
      'k3-course',
      'alipay',
      'https://ai.air7.fun'
    )

    expect(updatedRows[0]).toMatchObject({ status: 'cancelled', cancel_reason: 'superseded' })
    expect(insertedRows).toHaveLength(1)
  })

  it('cancels a freshly inserted row when the provider cannot build a checkout', async () => {
    const { createDeckOrder } = await import('./orders')
    getDeckPricing.mockResolvedValue({ title: 'K3', priceCents: 1900, currency: 'CNY' })
    hasPaidDeckOrder.mockResolvedValue(false)
    getPaymentProvider.mockReturnValue({
      name: 'alipay',
      createOrder: vi.fn().mockRejectedValue(new Error('gateway down')),
    })

    await expect(
      createDeckOrder(fakeSupabase(), 'user-1', 'a@b.com', 'k3-course', 'alipay', 'https://ai.air7.fun')
    ).rejects.toThrow('gateway down')

    expect(updatedRows[0]).toMatchObject({ status: 'cancelled', cancel_reason: 'error' })
  })
})
