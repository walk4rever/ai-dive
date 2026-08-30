import crypto from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAlipayProvider } from './alipay'

/** A throwaway RSA2 keypair standing in for the merchant key + Alipay's public key:
 *  the tests sign payloads with the "merchant"/"Alipay" side independently of
 *  alipay.ts, so they verify the documented algorithm rather than self-consistency. */
const merchant = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
const alipay = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })

const pem = (key: crypto.KeyObject, type: 'pkcs8' | 'spki') =>
  key.export({ type: type === 'pkcs8' ? 'pkcs8' : 'spki', format: 'pem' }).toString()

const config = {
  appId: '2021006194658068',
  privateKey: pem(merchant.privateKey, 'pkcs8'),
  alipayPublicKey: pem(alipay.publicKey, 'spki'),
  gateway: 'https://openapi.test/gateway.do',
}

/** Independent reimplementation of Alipay's sign-source rule: non-empty params
 *  sorted by key, joined `k=v&k2=v2`, values unencoded — `sign_type` included when
 *  signing a request, dropped when verifying a notification (this asymmetry is
 *  Alipay's, and getting it wrong is an `isv.invalid-signature` from the gateway). */
function requestSource(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((k) => k !== 'sign' && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')
}

function notifySource(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((k) => k !== 'sign' && k !== 'sign_type' && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')
}

function signAs(params: Record<string, string>, key: crypto.KeyObject): string {
  return crypto.createSign('RSA-SHA256').update(notifySource(params), 'utf8').sign(key, 'base64')
}

const originalFetch = global.fetch
afterEach(() => {
  global.fetch = originalFetch
  vi.useRealTimers()
})

describe('createAlipayProvider().createOrder', () => {
  const provider = createAlipayProvider(config)

  async function pageParams() {
    const { payUrl } = await provider.createOrder({
      outTradeNo: 'order-1',
      amountCents: 1990,
      title: 'K3 七天课',
      method: 'alipay',
      notifyUrl: 'https://ai-dive.test/api/orders/callback/alipay',
      returnUrl: 'https://ai-dive.test/decks',
    })
    const url = new URL(payUrl)
    return { url, params: Object.fromEntries(url.searchParams.entries()) }
  }

  it('builds a gateway payUrl carrying the page-pay interface parameters', async () => {
    const { url, params } = await pageParams()

    expect(url.origin + url.pathname).toBe('https://openapi.test/gateway.do')
    expect(params.app_id).toBe('2021006194658068')
    expect(params.method).toBe('alipay.trade.page.pay')
    expect(params.format).toBe('JSON')
    expect(params.charset).toBe('utf-8')
    expect(params.sign_type).toBe('RSA2')
    expect(params.version).toBe('1.0')
    expect(params.notify_url).toBe('https://ai-dive.test/api/orders/callback/alipay')
    expect(params.return_url).toBe('https://ai-dive.test/decks')
  })

  it('puts the order into biz_content with the PC checkout product code', async () => {
    const { params } = await pageParams()

    expect(JSON.parse(params.biz_content)).toEqual({
      out_trade_no: 'order-1',
      total_amount: '19.90',
      subject: 'K3 七天课',
      product_code: 'FAST_INSTANT_TRADE_PAY',
    })
  })

  it('signs with the merchant private key over the unencoded, sorted params', async () => {
    const { params } = await pageParams()
    const { sign, ...rest } = params

    const ok = crypto
      .createVerify('RSA-SHA256')
      .update(requestSource(rest), 'utf8')
      .verify(merchant.publicKey, sign, 'base64')
    expect(ok).toBe(true)
  })

  it('signs sign_type as part of the request, the way the gateway rebuilds it', async () => {
    const { params } = await pageParams()
    const { sign, ...rest } = params

    expect(requestSource(rest)).toContain('sign_type=RSA2')
    // Excluding it — the rule that applies to notifications, not requests — must not
    // produce a signature the gateway would accept.
    const asNotify = crypto
      .createVerify('RSA-SHA256')
      .update(notifySource(rest), 'utf8')
      .verify(merchant.publicKey, sign, 'base64')
    expect(asNotify).toBe(false)
  })

  it('stamps the timestamp in Beijing time regardless of the server clock zone', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-30T17:05:09Z')) // 北京时间次日 01:05:09

    const { params } = await pageParams()
    expect(params.timestamp).toBe('2026-08-31 01:05:09')
  })

  it('formats whole-yuan amounts with two decimals', async () => {
    const { payUrl } = await provider.createOrder({
      outTradeNo: 'order-2',
      amountCents: 2000,
      title: 'x',
      method: 'alipay',
      notifyUrl: 'https://x.test/notify',
      returnUrl: 'https://x.test/return',
    })
    const biz = JSON.parse(new URL(payUrl).searchParams.get('biz_content')!)
    expect(biz.total_amount).toBe('20.00')
  })

  it('refuses a wechat order instead of silently charging through Alipay', async () => {
    await expect(
      provider.createOrder({
        outTradeNo: 'order-3',
        amountCents: 100,
        title: 'x',
        method: 'wechat',
        notifyUrl: 'https://x.test/notify',
        returnUrl: 'https://x.test/return',
      })
    ).rejects.toThrow(/wechat/)
  })

  it('accepts a bare Base64 private key, not just a full PEM block', async () => {
    const bare = pem(merchant.privateKey, 'pkcs8')
      .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '')
      .replace(/\s+/g, '')

    const { payUrl } = await createAlipayProvider({ ...config, privateKey: bare }).createOrder({
      outTradeNo: 'order-4',
      amountCents: 100,
      title: 'x',
      method: 'alipay',
      notifyUrl: 'https://x.test/notify',
      returnUrl: 'https://x.test/return',
    })
    expect(new URL(payUrl).searchParams.get('sign')).toBeTruthy()
  })
})

describe('createAlipayProvider().verifyCallback', () => {
  const provider = createAlipayProvider(config)

  function notify(overrides: Record<string, string> = {}) {
    const base = {
      gmt_create: '2026-08-30 12:00:00',
      charset: 'utf-8',
      seller_email: 'shop@ai-dive.test',
      subject: 'K3 七天课',
      sign_type: 'RSA2',
      buyer_id: '2088000000000001',
      invoice_amount: '19.90',
      notify_id: 'notify-1',
      fund_bill_list: '[{"amount":"19.90","fundChannel":"ALIPAYACCOUNT"}]',
      notify_type: 'trade_status_sync',
      trade_status: 'TRADE_SUCCESS',
      receipt_amount: '19.90',
      app_id: '2021006194658068',
      buyer_pay_amount: '19.90',
      out_trade_no: 'order-1',
      trade_no: '2026083022001400001234567890',
      total_amount: '19.90',
      ...overrides,
    }
    return { ...base, sign: signAs(base, alipay.privateKey) }
  }

  it('accepts a correctly signed successful payment', () => {
    expect(provider.verifyCallback(notify())).toEqual({
      outTradeNo: 'order-1',
      providerOrderId: '2026083022001400001234567890',
      amountCents: 1990,
    })
  })

  it('accepts TRADE_FINISHED as well as TRADE_SUCCESS', () => {
    expect(provider.verifyCallback(notify({ trade_status: 'TRADE_FINISHED' }))?.outTradeNo).toBe('order-1')
  })

  it('rejects a tampered amount even though the rest of the payload is untouched', () => {
    expect(provider.verifyCallback({ ...notify(), total_amount: '0.01' })).toBeNull()
  })

  it('rejects a callback with no signature at all', () => {
    const unsigned = { ...notify(), sign: '' }
    delete (unsigned as Partial<typeof unsigned>).sign
    expect(provider.verifyCallback(unsigned)).toBeNull()
  })

  it('rejects a payload signed by someone other than Alipay', () => {
    const base = { app_id: config.appId, out_trade_no: 'order-1', trade_no: 'x', total_amount: '19.90', trade_status: 'TRADE_SUCCESS' }
    expect(provider.verifyCallback({ ...base, sign: signAs(base, merchant.privateKey) })).toBeNull()
  })

  it('rejects a genuine Alipay notification addressed to a different app', () => {
    expect(provider.verifyCallback(notify({ app_id: '2021000000000000' }))).toBeNull()
  })

  it('rejects a non-success trade_status even with a valid signature', () => {
    expect(provider.verifyCallback(notify({ trade_status: 'WAIT_BUYER_PAY' }))).toBeNull()
  })
})

describe('createAlipayProvider().queryStatus', () => {
  const provider = createAlipayProvider(config)

  /** Builds a gateway response the way Alipay does: `sign` covers the raw JSON text
   *  of the business node exactly as it appears on the wire. */
  function response(node: Record<string, string>, signer = alipay.privateKey) {
    const content = JSON.stringify(node)
    const sign = crypto.createSign('RSA-SHA256').update(content, 'utf8').sign(signer, 'base64')
    return `{"alipay_trade_query_response":${content},"sign":"${sign}"}`
  }

  const paidNode = {
    code: '10000',
    msg: 'Success',
    trade_no: '2026083022001400001234567890',
    out_trade_no: 'order-1',
    trade_status: 'TRADE_SUCCESS',
    total_amount: '19.90',
  }

  function mockGateway(body: string, status = 200) {
    const spy = vi.fn(async () => new Response(body, { status }))
    global.fetch = spy as unknown as typeof fetch
    return spy
  }

  it('is true for a signed response reporting a successful trade', async () => {
    const spy = mockGateway(response(paidNode))

    await expect(provider.queryStatus('order-1')).resolves.toBe(true)

    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(config.gateway)
    const sent = new URLSearchParams(init.body as string)
    expect(sent.get('method')).toBe('alipay.trade.query')
    expect(JSON.parse(sent.get('biz_content')!)).toEqual({ out_trade_no: 'order-1' })
  })

  it('is false for a signed response reporting an unpaid trade', async () => {
    mockGateway(response({ ...paidNode, trade_status: 'WAIT_BUYER_PAY' }))
    await expect(provider.queryStatus('order-1')).resolves.toBe(false)
  })

  it('is false when the response signature is not Alipay’s', async () => {
    mockGateway(response(paidNode, merchant.privateKey))
    await expect(provider.queryStatus('order-1')).resolves.toBe(false)
  })

  it('is false for an unsigned error response', async () => {
    mockGateway('{"alipay_trade_query_response":{"code":"40004","msg":"Business Failed"}}')
    await expect(provider.queryStatus('order-1')).resolves.toBe(false)
  })

  it('is false on a non-ok HTTP response', async () => {
    mockGateway('', 502)
    await expect(provider.queryStatus('order-1')).resolves.toBe(false)
  })
})
