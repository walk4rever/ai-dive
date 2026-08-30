import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const createServiceClient = vi.fn()
const getProviderByName = vi.fn()
const markOrderPaid = vi.fn()

vi.mock('@/lib/supabase/server', () => ({ createServiceClient }))
vi.mock('@/lib/payments', () => ({ getProviderByName }))
vi.mock('@/lib/payments/settle', () => ({ markOrderPaid }))

function callbackReq(query: Record<string, string>) {
  const url = new URL('http://localhost/api/orders/callback/epay')
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)
  return new NextRequest(url)
}

describe('GET /api/orders/callback/epay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    createServiceClient.mockResolvedValue({})
  })

  it('returns "fail" without touching the database when verification fails', async () => {
    getProviderByName.mockReturnValue({ verifyCallback: () => null })

    const { GET } = await import('./route')
    const res = await GET(callbackReq({ sign: 'bad' }))

    expect(res.status).toBe(400)
    expect(await res.text()).toBe('fail')
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it('returns 500 "fail" if the provider throws (e.g. not configured)', async () => {
    getProviderByName.mockImplementation(() => {
      throw new Error('Payment provider not configured')
    })

    const { GET } = await import('./route')
    const res = await GET(callbackReq({}))

    expect(res.status).toBe(500)
    expect(await res.text()).toBe('fail')
  })

  it('marks the order paid and returns "success" on a verified callback', async () => {
    getProviderByName.mockReturnValue({
      verifyCallback: () => ({ outTradeNo: 'order-1', providerOrderId: 'epay-txn-1', amountCents: 1990 }),
    })
    markOrderPaid.mockResolvedValue('paid')

    const { GET } = await import('./route')
    const res = await GET(callbackReq({ out_trade_no: 'order-1', trade_no: 'epay-txn-1', sign: 'ok' }))

    expect(await res.text()).toBe('success')
    expect(res.status).toBe(200)
  })

  it('returns 500 "fail" if the database update errors', async () => {
    getProviderByName.mockReturnValue({
      verifyCallback: () => ({ outTradeNo: 'order-1', providerOrderId: 'epay-txn-1', amountCents: 1990 }),
    })
    markOrderPaid.mockResolvedValue('error')

    const { GET } = await import('./route')
    const res = await GET(callbackReq({ out_trade_no: 'order-1', trade_no: 'epay-txn-1', sign: 'ok' }))

    expect(res.status).toBe(500)
    expect(await res.text()).toBe('fail')
  })
})
