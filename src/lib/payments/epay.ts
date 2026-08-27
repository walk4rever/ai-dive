import crypto from 'node:crypto'
import type { CallbackResult, CreateOrderInput, CreateOrderResult, PaymentProvider } from './types'

/** Implements the widely-cloned "易支付" (epay) aggregator protocol — the same
 *  request/callback shape used by 虎皮椒's legacy API and most of the small,
 *  individual-friendly aggregators (码支付, 彩虹易支付 clones, ZPAY, etc.), which is
 *  exactly the category viable for this project today (see TODO.md 阶段 4.3 — no
 *  business entity to open an official channel with). Building against the shared
 *  protocol rather than one vendor's bespoke API keeps the choice of *which*
 *  aggregator to sign up with a config change, not a rewrite. */

const METHOD_TO_TYPE: Record<CreateOrderInput['method'], string> = {
  alipay: 'alipay',
  wechat: 'wxpay',
}

function centsToYuan(cents: number): string {
  return (cents / 100).toFixed(2)
}

function yuanToCents(yuan: string): number {
  return Math.round(Number(yuan) * 100)
}

/** epay's sign: take every non-empty param except sign/sign_type, sort by key
 *  ascending, join as `k=v&k2=v2`, append the merchant key, md5, lowercase hex.
 *  Used identically for outbound request signing and inbound callback verification —
 *  both sides must build byte-identical strings for a signature to ever match. */
function sign(params: Record<string, string | undefined>, key: string): string {
  const qs = Object.keys(params)
    .filter((k) => k !== 'sign' && k !== 'sign_type' && params[k] !== undefined && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')

  return crypto.createHash('md5').update(qs + key).digest('hex')
}

export interface EpayConfig {
  pid: string
  key: string
  /** Origin only, no trailing slash — e.g. https://zpayz.cn */
  baseUrl: string
}

export function createEpayProvider(config: EpayConfig): PaymentProvider {
  return {
    name: 'epay',

    // Uses the page-jump order interface (submit.php), not the API interface
    // (mapi.php): submit.php doesn't need clientip/device, so building the payUrl
    // needs no I/O and no request-context plumbing — just string building.
    async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
      const params: Record<string, string> = {
        pid: config.pid,
        type: METHOD_TO_TYPE[input.method],
        out_trade_no: input.outTradeNo,
        name: input.title,
        money: centsToYuan(input.amountCents),
        notify_url: input.notifyUrl,
        return_url: input.returnUrl,
        sign_type: 'MD5',
      }

      const query = new URLSearchParams({ ...params, sign: sign(params, config.key) })
      return { payUrl: `${config.baseUrl}/submit.php?${query.toString()}` }
    },

    verifyCallback(params: Record<string, string>): CallbackResult | null {
      if (!params.sign || sign(params, config.key) !== params.sign) return null
      if (params.trade_status !== 'TRADE_SUCCESS') return null
      if (!params.out_trade_no || !params.trade_no || !params.money) return null

      return {
        outTradeNo: params.out_trade_no,
        providerOrderId: params.trade_no,
        amountCents: yuanToCents(params.money),
      }
    },

    async queryStatus(outTradeNo: string): Promise<boolean> {
      const url = `${config.baseUrl}/api.php?act=order&pid=${encodeURIComponent(config.pid)}&key=${encodeURIComponent(config.key)}&out_trade_no=${encodeURIComponent(outTradeNo)}`
      const res = await fetch(url)
      if (!res.ok) return false

      const data = await res.json().catch(() => null)
      return (data as { status?: number } | null)?.status === 1
    },
  }
}
