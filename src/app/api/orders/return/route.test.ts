import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getServerSession = vi.fn()
const createServiceClient = vi.fn()
const syncOrderForUser = vi.fn()

vi.mock('next-auth', () => ({ getServerSession }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient }))
vi.mock('@/lib/payments/sync', () => ({ syncOrderForUser }))

function req(order?: string) {
  const query = order ? `?order=${order}` : ''
  return new NextRequest(`http://localhost/api/orders/return${query}`)
}

async function call(order?: string) {
  const { GET } = await import('./route')
  return GET(req(order))
}

describe('GET /api/orders/return', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getServerSession.mockResolvedValue({ user: { id: 'user-1' } })
    createServiceClient.mockResolvedValue({})
    syncOrderForUser.mockResolvedValue('paid')
  })

  it('syncs the returned order before sending the browser to the deck list', async () => {
    const res = await call('order-1')

    expect(syncOrderForUser).toHaveBeenCalledWith({}, 'user-1', 'order-1')
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('http://localhost/decks')
  })

  it('lands on the deck list without a sync when the URL has no order', async () => {
    const res = await call()

    expect(syncOrderForUser).not.toHaveBeenCalled()
    expect(res.status).toBe(303)
  })

  it('still redirects when the status lookup fails', async () => {
    syncOrderForUser.mockRejectedValue(new Error('gateway down'))

    const res = await call('order-1')
    expect(res.status).toBe(303)
  })
})
