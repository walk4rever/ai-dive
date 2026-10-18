import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const createServiceClient = vi.fn()
const expireStalePendingOrders = vi.fn()

vi.mock('@/lib/supabase/server', () => ({ createServiceClient }))
vi.mock('@/lib/orders/expire', () => ({ expireStalePendingOrders }))

function req(secret?: string) {
  return new NextRequest('http://localhost/api/cron/expire-orders', {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  })
}

async function call(secret?: string) {
  const { GET } = await import('./route')
  return GET(req(secret))
}

describe('GET /api/cron/expire-orders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', 'cron-secret')
    createServiceClient.mockResolvedValue({})
    expireStalePendingOrders.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('rejects a request without the cron secret', async () => {
    const res = await call()
    expect(res.status).toBe(401)
    expect(expireStalePendingOrders).not.toHaveBeenCalled()
  })

  it('rejects a wrong cron secret', async () => {
    const res = await call('wrong')
    expect(res.status).toBe(401)
  })

  it('sweeps all stale pending orders with the right secret', async () => {
    const res = await call('cron-secret')

    expect(res.status).toBe(200)
    expect(expireStalePendingOrders).toHaveBeenCalledWith({})
  })

  it('reports a failed sweep as a 500', async () => {
    expireStalePendingOrders.mockResolvedValue(false)

    const res = await call('cron-secret')
    expect(res.status).toBe(500)
  })
})
