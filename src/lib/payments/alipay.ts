import crypto from 'node:crypto'
import type { CallbackResult, CreateOrderInput, CreateOrderResult, PaymentProvider } from './types'

/** Official Alipay 电脑网站支付 (`alipay.trade.page.pay`), 公钥模式 / RSA2 — the
 *  compliant channel that replaces the epay aggregator (see epay.ts) now that there
 *  is a real merchant account. Implements the same `PaymentProvider` interface, so
 *  swapping channels is a `getPaymentProvider()` change, not an order-model change. */

const GATEWAY = 'https://openapi.alipay.com/gateway.do'

/** Alipay requires `yyyy-MM-dd HH:mm:ss` in Beijing time, and rejects a timestamp
 *  more than ~15 minutes off — so it must not follow the server's TZ (Vercel is UTC). */
function beijingTimestamp(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(now)

  const get = (type: string) => parts.find((p) => p.type === type)!.value
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`
}

function centsToYuan(cents: number): string {
  return (cents / 100).toFixed(2)
}

/** Non-empty params, sorted by key, joined `k=v&k2=v2` with values *unencoded*.
 *
 *  The two directions differ in one field and only one: an outbound request signs
 *  `sign_type` along with everything else, while an inbound notification drops it
 *  (Alipay's gateway rebuilds the string that way, and dropping it on requests is
 *  exactly what an `isv.invalid-signature` looks like). */
function signSource(params: Record<string, string | undefined>, dropSignType: boolean): string {
  return Object.keys(params)
    .filter((k) => k !== 'sign' && !(dropSignType && k === 'sign_type'))
    .filter((k) => params[k] !== undefined && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')
}

function sign(params: Record<string, string>, privateKey: string): string {
  return crypto.createSign('RSA-SHA256').update(signSource(params, false), 'utf8').sign(privateKey, 'base64')
}

/** Accepts both a full PEM block and the bare Base64 body that the Alipay console
 *  and key-generation tool hand out, so whichever form ends up in the env var works. */
function toPem(key: string, label: 'PUBLIC KEY' | 'PRIVATE KEY'): string {
  const trimmed = key.trim()
  if (trimmed.startsWith('-----BEGIN')) return trimmed

  const body = trimmed.replace(/\s+/g, '').match(/.{1,64}/g)?.join('\n') ?? ''
  return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----`
}

export interface AlipayConfig {
  /** The 16-digit open-platform app id — not the merchant PID. */
  appId: string
  /** Merchant RSA2 private key (PKCS#8), PEM or bare Base64. */
  privateKey: string
  /** Alipay's public key from 开发设置 → 接口加签方式, PEM or bare Base64. */
  alipayPublicKey: string
  gateway?: string
}

export function createAlipayProvider(config: AlipayConfig): PaymentProvider {
  const gateway = config.gateway ?? GATEWAY
  const privateKey = toPem(config.privateKey, 'PRIVATE KEY')
  const publicKey = toPem(config.alipayPublicKey, 'PUBLIC KEY')

  function commonParams(method: string, bizContent: unknown): Record<string, string> {
    return {
      app_id: config.appId,
      method,
      format: 'JSON',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: beijingTimestamp(new Date()),
      version: '1.0',
      biz_content: JSON.stringify(bizContent),
    }
  }

  return {
    name: 'alipay',

    async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
      if (input.method !== 'alipay') {
        throw new Error(`Alipay provider cannot handle method "${input.method}"`)
      }

      const params: Record<string, string> = {
        ...commonParams('alipay.trade.page.pay', {
          out_trade_no: input.outTradeNo,
          total_amount: centsToYuan(input.amountCents),
          subject: input.title,
          product_code: 'FAST_INSTANT_TRADE_PAY',
        }),
        notify_url: input.notifyUrl,
        return_url: input.returnUrl,
      }

      // GET-redirect form of the page-pay interface: everything is in the query
      // string, so no I/O is needed to hand the browser a checkout URL.
      const query = new URLSearchParams({ ...params, sign: sign(params, privateKey) })
      return { payUrl: `${gateway}?${query.toString()}` }
    },

    verifyCallback(params: Record<string, string>): CallbackResult | null {
      if (!params.sign) return null

      const ok = crypto
        .createVerify('RSA-SHA256')
        .update(signSource(params, true), 'utf8')
        .verify(publicKey, params.sign, 'base64')
      if (!ok) return null

      // A valid signature only proves Alipay sent it — it does not prove it was sent
      // to *this* app, so app_id is checked too, per Alipay's notify checklist.
      if (params.app_id !== config.appId) return null
      if (params.trade_status !== 'TRADE_SUCCESS' && params.trade_status !== 'TRADE_FINISHED') return null
      if (!params.out_trade_no || !params.trade_no || !params.total_amount) return null

      return {
        outTradeNo: params.out_trade_no,
        providerOrderId: params.trade_no,
        amountCents: Math.round(Number(params.total_amount) * 100),
      }
    },

    async queryStatus(outTradeNo: string): Promise<boolean> {
      const params = commonParams('alipay.trade.query', { out_trade_no: outTradeNo })
      const body = new URLSearchParams({ ...params, sign: sign(params, privateKey) })

      const res = await fetch(gateway, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
        body: body.toString(),
      })
      if (!res.ok) return false

      const raw = await res.text()
      const node = verifyResponse(raw, 'alipay_trade_query_response', publicKey)
      if (!node) return false

      const status = (node as { trade_status?: string }).trade_status
      return status === 'TRADE_SUCCESS' || status === 'TRADE_FINISHED'
    },
  }
}

/** Verifies a gateway response and returns its business node, or null if the
 *  signature is absent/invalid. Alipay signs the *raw* JSON substring of the
 *  business node, so the text has to be sliced before parsing — re-serializing the
 *  parsed object would reorder and reformat it, and never verify. */
function verifyResponse(raw: string, nodeName: string, publicKey: string): unknown | null {
  const parsed = JSON.parse(raw) as Record<string, unknown>
  const signature = parsed.sign
  if (typeof signature !== 'string') return null

  const start = raw.indexOf(`"${nodeName}"`)
  if (start < 0) return null
  const contentStart = raw.indexOf('{', start)
  const contentEnd = raw.lastIndexOf(',"sign"')
  if (contentStart < 0 || contentEnd <= contentStart) return null

  const content = raw.slice(contentStart, contentEnd)
  const ok = crypto.createVerify('RSA-SHA256').update(content, 'utf8').verify(publicKey, signature, 'base64')
  if (!ok) return null

  return JSON.parse(content)
}
