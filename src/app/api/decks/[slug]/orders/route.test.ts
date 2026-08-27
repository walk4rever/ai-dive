import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getServerSession = vi.fn()
const createServiceClient = vi.fn()
const createDeckOrder = vi.fn()

vi.mock('next-auth', () => ({ getServerSession }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient }))
vi.mock('@/lib/decks/orders', async () => {
  const actual = await vi.importActual<typeof import('@/lib/decks/orders')>('@/lib/decks/orders')
  return { ...actual, createDeckOrder }
})

function postReq(body: unknown) {
  return new NextRequest('http://localhost/api/decks/k3-course/orders', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('POST /api/decks/[slug]/orders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createServiceClient.mockResolvedValue({})
  })

  it('rejects unauthenticated requests', async () => {
    getServerSession.mockResolvedValue(null)
    const { POST } = await import('./route')
    const res = await POST(postReq({ method: 'alipay' }), { params: Promise.resolve({ slug: 'k3-course' }) })
    expect(res.status).toBe(401)
  })

  it('rejects a session with no email on file', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'user-1', email: null } })
    const { POST } = await import('./route')
    const res = await POST(postReq({ method: 'alipay' }), { params: Promise.resolve({ slug: 'k3-course' }) })
    expect(res.status).toBe(400)
  })

  it('rejects an invalid payment method', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'user-1', email: 'a@b.com' } })
    const { POST } = await import('./route')
    const res = await POST(postReq({ method: 'bitcoin' }), { params: Promise.resolve({ slug: 'k3-course' }) })
    expect(res.status).toBe(400)
  })

  it('returns 409 when the deck isn\'t purchasable', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'user-1', email: 'a@b.com' } })
    const { DeckOrderError } = await import('@/lib/decks/orders')
    createDeckOrder.mockRejectedValue(new DeckOrderError('This deck is not for sale'))

    const { POST } = await import('./route')
    const res = await POST(postReq({ method: 'alipay' }), { params: Promise.resolve({ slug: 'k3-course' }) })
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.error).toBe('This deck is not for sale')
  })

  it('returns 500 for an unexpected error', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'user-1', email: 'a@b.com' } })
    createDeckOrder.mockRejectedValue(new Error('boom'))

    const { POST } = await import('./route')
    const res = await POST(postReq({ method: 'alipay' }), { params: Promise.resolve({ slug: 'k3-course' }) })
    expect(res.status).toBe(500)
  })

  it('creates the order with a same-origin callback/return URL and returns the payUrl', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'user-1', email: 'a@b.com' } })
    createDeckOrder.mockResolvedValue({ payUrl: 'https://pay.example.com/submit.php?x=y' })

    const { POST } = await import('./route')
    const res = await POST(postReq({ method: 'alipay' }), { params: Promise.resolve({ slug: 'k3-course' }) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.payUrl).toBe('https://pay.example.com/submit.php?x=y')
    expect(createDeckOrder).toHaveBeenCalledWith(
      {},
      'user-1',
      'a@b.com',
      'k3-course',
      'alipay',
      'http://localhost/api/orders/callback/epay',
      'http://localhost/decks'
    )
  })
})
