import { createEpayProvider } from './epay'
import type { PaymentProvider } from './types'

export type { CallbackResult, CreateOrderInput, CreateOrderResult, PaymentProvider } from './types'

/** Single seam for picking a payment channel, read fresh from env on every call (no
 *  module-level caching) — construction is pure object/closure creation, no I/O, so
 *  there's nothing worth caching and it keeps this trivial to reset between tests. */
export function getPaymentProvider(): PaymentProvider {
  const pid = process.env.EPAY_PID
  const key = process.env.EPAY_KEY
  const baseUrl = process.env.EPAY_BASE_URL

  if (!pid || !key || !baseUrl) {
    throw new Error('Payment provider not configured: set EPAY_PID, EPAY_KEY, EPAY_BASE_URL')
  }

  return createEpayProvider({ pid, key, baseUrl })
}
