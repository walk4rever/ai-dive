import { createAlipayProvider } from './alipay'
import { createEpayProvider } from './epay'
import type { CreateOrderInput, PaymentProvider } from './types'

export type { CallbackResult, CreateOrderInput, CreateOrderResult, PaymentProvider } from './types'

/** Single seam for picking a payment channel, read fresh from env on every call (no
 *  module-level caching) — construction is pure object/closure creation, no I/O, so
 *  there's nothing worth caching and it keeps this trivial to reset between tests. */
export function getPaymentProvider(method: CreateOrderInput['method']): PaymentProvider {
  // Alipay now has an official merchant channel; WeChat has no entity behind it yet,
  // so it stays on the epay aggregator until that changes (see TODO.md 阶段 4.3).
  return getProviderByName(method === 'alipay' ? 'alipay' : 'epay')
}

/** Looks a provider up by the `name` stored on the order row — the callback routes
 *  need it, since a callback arrives with no `method`, only its own channel. */
export function getProviderByName(name: string): PaymentProvider {
  if (name === 'alipay') {
    const appId = process.env.ALIPAY_APP_ID
    const privateKey = process.env.ALIPAY_PRIVATE_KEY
    const alipayPublicKey = process.env.ALIPAY_PUBLIC_KEY

    if (!appId || !privateKey || !alipayPublicKey) {
      throw new Error('Alipay not configured: set ALIPAY_APP_ID, ALIPAY_PRIVATE_KEY, ALIPAY_PUBLIC_KEY')
    }
    return createAlipayProvider({ appId, privateKey, alipayPublicKey })
  }

  if (name === 'epay') {
    const pid = process.env.EPAY_PID
    const key = process.env.EPAY_KEY
    const baseUrl = process.env.EPAY_BASE_URL

    if (!pid || !key || !baseUrl) {
      throw new Error('Payment provider not configured: set EPAY_PID, EPAY_KEY, EPAY_BASE_URL')
    }
    return createEpayProvider({ pid, key, baseUrl })
  }

  throw new Error(`Unknown payment provider "${name}"`)
}
