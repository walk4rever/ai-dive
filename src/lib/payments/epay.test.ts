import crypto from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEpayProvider } from './epay'

/** Independently reimplements the documented epay sign algorithm (not imported from
 *  epay.ts) so these tests catch a real divergence from spec, not just internal
 *  self-consistency. */
function computeSign(params: Record<string, string>, key: string): string {
  const qs = Object.keys(params)
    .filter((k) => k !== 'sign' && k !== 'sign_type' && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')
  return crypto.createHash('md5').update(qs + key).digest('hex')
}

const config = { pid: '1000', key: 'test-key', baseUrl: 'https://pay.example.com' }
const originalFetch = global.fetch

afterEach(() => {
  global.fetch = originalFetch
})

describe('createEpayProvider().createOrder', () => {
  it('builds a submit.php payUrl with a signature matching the documented algorithm', async () => {
    const provider = createEpayProvider(config)
    const { payUrl } = await provider.createOrder({
      outTradeNo: 'order-1',
      amountCents: 1990,
      title: 'K3 七天课',
      method: 'alipay',
      notifyUrl: 'https://ai-dive.test/api/orders/callback/epay',
      returnUrl: 'https://ai-dive.test/decks',
    })

    const url = new URL(payUrl)
    expect(url.origin + url.pathname).toBe('https://pay.example.com/submit.php')

    const params = Object.fromEntries(url.searchParams.entries())
    expect(params.pid).toBe('1000')
    expect(params.type).toBe('alipay')
    expect(params.out_trade_no).toBe('order-1')
    expect(params.name).toBe('K3 七天课')
    expect(params.money).toBe('19.90')
    expect(params.notify_url).toBe('https://ai-dive.test/api/orders/callback/epay')
    expect(params.return_url).toBe('https://ai-dive.test/decks')
    expect(params.sign_type).toBe('MD5')
    expect(params.sign).toBe(computeSign(params, config.key))
  })

  it('maps method "wechat" to the wxpay type code', async () => {
    const provider = createEpayProvider(config)
    const { payUrl } = await provider.createOrder({
      outTradeNo: 'order-2',
      amountCents: 100,
      title: 'x',
      method: 'wechat',
      notifyUrl: 'https://x.test/notify',
      returnUrl: 'https://x.test/return',
    })
    expect(new URL(payUrl).searchParams.get('type')).toBe('wxpay')
  })

  it('formats whole-yuan amounts with two decimals', async () => {
    const provider = createEpayProvider(config)
    const { payUrl } = await provider.createOrder({
      outTradeNo: 'order-3',
      amountCents: 2000,
      title: 'x',
      method: 'alipay',
      notifyUrl: 'https://x.test/notify',
      returnUrl: 'https://x.test/return',
    })
    expect(new URL(payUrl).searchParams.get('money')).toBe('20.00')
  })
})

describe('createEpayProvider().verifyCallback', () => {
  const provider = createEpayProvider(config)

  function validParams(overrides: Record<string, string> = {}) {
    const base = {
      pid: '1000',
      name: 'K3 七天课',
      money: '19.90',
      out_trade_no: 'order-1',
      trade_no: 'epay-txn-1',
      trade_status: 'TRADE_SUCCESS',
      type: 'alipay',
      sign_type: 'MD5',
      ...overrides,
    }
    return { ...base, sign: computeSign(base, config.key) }
  }

  it('accepts a correctly signed successful payment', () => {
    expect(provider.verifyCallback(validParams())).toEqual({
      outTradeNo: 'order-1',
      providerOrderId: 'epay-txn-1',
      amountCents: 1990,
    })
  })

  it('rejects a tampered field even though the rest of the payload is untouched', () => {
    const params = validParams()
    expect(provider.verifyCallback({ ...params, money: '0.01' })).toBeNull()
  })

  it('rejects a callback with no signature at all', () => {
    const withoutSign = {
      pid: '1000',
      name: 'K3 七天课',
      money: '19.90',
      out_trade_no: 'order-1',
      trade_no: 'epay-txn-1',
      trade_status: 'TRADE_SUCCESS',
    }
    expect(provider.verifyCallback(withoutSign)).toBeNull()
  })

  it('rejects a non-success trade_status even with an otherwise-valid signature', () => {
    expect(provider.verifyCallback(validParams({ trade_status: 'TRADE_PENDING' }))).toBeNull()
  })

  it('rejects a signature computed with the wrong key', () => {
    const base = {
      pid: '1000',
      name: 'x',
      money: '19.90',
      out_trade_no: 'order-1',
      trade_no: 'epay-txn-1',
      trade_status: 'TRADE_SUCCESS',
    }
    expect(provider.verifyCallback({ ...base, sign: computeSign(base, 'not-the-real-key') })).toBeNull()
  })
})

describe('createEpayProvider().queryStatus', () => {
  it('is true when the order API reports status 1', async () => {
    const provider = createEpayProvider(config)
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ status: 1 }), { status: 200 }))
    global.fetch = fetchSpy as unknown as typeof fetch

    await expect(provider.queryStatus('order-1')).resolves.toBe(true)
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('act=order'))
  })

  it('is false when the order API reports status 0', async () => {
    const provider = createEpayProvider(config)
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ status: 0 }), { status: 200 })) as unknown as typeof fetch

    await expect(provider.queryStatus('order-1')).resolves.toBe(false)
  })

  it('is false on a non-ok HTTP response', async () => {
    const provider = createEpayProvider(config)
    global.fetch = vi.fn(async () => new Response('', { status: 500 })) as unknown as typeof fetch

    await expect(provider.queryStatus('order-1')).resolves.toBe(false)
  })
})
