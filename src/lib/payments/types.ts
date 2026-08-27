/** Provider-agnostic seam for TODO.md 阶段 4.3: the only payment channel viable today
 *  (a personal 二清 aggregator, see below) is expected to get replaced once this
 *  project has a business entity or an overseas account to open a compliant channel
 *  with — this interface exists so that swap touches one new implementation file and
 *  a config change, not the order model, the routes, or the callback handling. */
export interface CreateOrderInput {
  /** Our own order id (ai_pulse_orders.id) — round-trips back on the callback as
   *  out_trade_no so we can find the row to mark paid without trusting anything else
   *  the provider sends. */
  outTradeNo: string
  amountCents: number
  title: string
  method: 'alipay' | 'wechat'
  notifyUrl: string
  returnUrl: string
}

export interface CreateOrderResult {
  /** URL to send the browser to — a checkout/QR page hosted by the provider. */
  payUrl: string
}

export interface CallbackResult {
  outTradeNo: string
  providerOrderId: string
  amountCents: number
}

export interface PaymentProvider {
  name: string
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>
  /** Verifies an inbound callback's signature and payment-success status in one
   *  step. Returns null for anything that isn't a verified, successful payment
   *  (bad signature, wrong status, missing fields) — callers must treat null as
   *  "ignore this, do not mark any order paid". */
  verifyCallback(params: Record<string, string>): CallbackResult | null
  queryStatus(outTradeNo: string): Promise<boolean>
}
