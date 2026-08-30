import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const createServiceClient = vi.fn()
const getProviderByName = vi.fn()
const markOrderPaid = vi.fn()

vi.mock('@/lib/supabase/server', () => ({ createServiceClient }))
vi.mock('@/lib/payments', () => ({ getProviderByName }))
vi.mock('@/lib/payments/settle', () => ({ markOrderPaid }))

/** Alipay posts its notification as a form body, not a query string. */
function notifyReq(params: Record<string, string>) {
  const body = new URLSearchParams(params)
  return new NextRequest('http://localhost/api/orders/callback/alipay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
}

const verified = { outTradeNo: 'order-1', providerOrderId: 'alipay-txn-1', amountCents: 1990 }

describe('POST /api/orders/callback/alipay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    createServiceClient.mockResolvedValue({})
  })

  it('passes the posted form fields to the provider for verification', async () => {
    const verifyCallback = vi.fn().mockReturnValue(verified)
    getProviderByName.mockReturnValue({ verifyCallback })
    markOrderPaid.mockResolvedValue('paid')

    const { POST } = await import('./route')
    await POST(notifyReq({ out_trade_no: 'order-1', trade_status: 'TRADE_SUCCESS', sign: 'ok' }))

    expect(getProviderByName).toHaveBeenCalledWith('alipay')
    expect(verifyCallback).toHaveBeenCalledWith({
      out_trade_no: 'order-1',
      trade_status: 'TRADE_SUCCESS',
      sign: 'ok',
    })
  })

  it('answers the literal "success" Alipay needs once the order is settled', async () => {
    getProviderByName.mockReturnValue({ verifyCallback: () => verified })
    markOrderPaid.mockResolvedValue('paid')

    const { POST } = await import('./route')
    const res = await POST(notifyReq({ sign: 'ok' }))

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('success')
    expect(markOrderPaid).toHaveBeenCalledWith({}, 'alipay', verified)
  })

  it('answers "success" for a retried notification of an already-paid order', async () => {
    getProviderByName.mockReturnValue({ verifyCallback: () => verified })
    markOrderPaid.mockResolvedValue('already_paid')

    const { POST } = await import('./route')
    expect(await (await POST(notifyReq({ sign: 'ok' }))).text()).toBe('success')
  })

  it('does not acknowledge a payment whose amount does not match the order', async () => {
    getProviderByName.mockReturnValue({ verifyCallback: () => verified })
    markOrderPaid.mockResolvedValue('amount_mismatch')

    const { POST } = await import('./route')
    const res = await POST(notifyReq({ sign: 'ok' }))

    expect(res.status).toBe(400)
    expect(await res.text()).toBe('fail')
  })

  it('returns "fail" without touching the database when verification fails', async () => {
    getProviderByName.mockReturnValue({ verifyCallback: () => null })

    const { POST } = await import('./route')
    const res = await POST(notifyReq({ sign: 'forged' }))

    expect(res.status).toBe(400)
    expect(await res.text()).toBe('fail')
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it('returns 500 "fail" if the provider is not configured', async () => {
    getProviderByName.mockImplementation(() => {
      throw new Error('Alipay not configured')
    })

    const { POST } = await import('./route')
    const res = await POST(notifyReq({ sign: 'ok' }))

    expect(res.status).toBe(500)
    expect(await res.text()).toBe('fail')
  })

  it('returns 500 "fail" if settling the order errors', async () => {
    getProviderByName.mockReturnValue({ verifyCallback: () => verified })
    markOrderPaid.mockResolvedValue('error')

    const { POST } = await import('./route')
    expect((await POST(notifyReq({ sign: 'ok' }))).status).toBe(500)
  })
})
