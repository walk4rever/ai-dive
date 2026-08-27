import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getServerSession = vi.fn()
const createClient = vi.fn()
const createServiceClient = vi.fn()
const fetchRecentTurns = vi.fn()
const ensureFreeGrant = vi.fn()
const getBalance = vi.fn()
const recordSpend = vi.fn()
const withinHourlyLimit = vi.fn()

vi.mock('next-auth', () => ({ getServerSession }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/supabase/server', () => ({ createClient, createServiceClient }))
vi.mock('@/lib/agent-context', async () => {
  const actual = await vi.importActual<typeof import('@/lib/agent-context')>('@/lib/agent-context')
  return { ...actual, fetchRecentTurns }
})
vi.mock('@/lib/credits', () => ({ ensureFreeGrant, getBalance, recordSpend, withinHourlyLimit }))

const originalFetch = global.fetch

describe('POST /api/agent', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.AI_DIVE_AGENT_GATEWAY_URL = 'http://gateway.local'
    process.env.AI_DIVE_AGENT_SECRET = 'secret'
    createClient.mockResolvedValue({
      from: () => ({
        select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ single: async () => ({ data: null }) }) }) }) }),
      }),
    })
    createServiceClient.mockResolvedValue({})
    fetchRecentTurns.mockResolvedValue([])
    ensureFreeGrant.mockResolvedValue(undefined)
    getBalance.mockResolvedValue(10)
    recordSpend.mockResolvedValue(undefined)
    withinHourlyLimit.mockResolvedValue(true)
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('rejects unauthenticated requests', async () => {
    getServerSession.mockResolvedValue(null)
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/agent', { method: 'POST', body: JSON.stringify({ message: 'hi' }) })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 429 without calling the gateway when the hourly limit is hit', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'user-1', email: 'a@b.com', role: 'user' } })
    withinHourlyLimit.mockResolvedValue(false)
    const fetchSpy = vi.fn()
    global.fetch = fetchSpy as unknown as typeof fetch

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/agent', { method: 'POST', body: JSON.stringify({ message: 'hi' }) })
    const res = await POST(req)

    expect(res.status).toBe(429)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns 402 without calling the gateway when the monthly balance is exhausted', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'user-1', email: 'a@b.com', role: 'user' } })
    getBalance.mockResolvedValue(0)
    const fetchSpy = vi.fn()
    global.fetch = fetchSpy as unknown as typeof fetch

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/agent', { method: 'POST', body: JSON.stringify({ message: 'hi' }) })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(402)
    expect(json.code).toBe('insufficient_credits')
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(ensureFreeGrant).toHaveBeenCalled()
  })

  it('records spend only after the gateway accepts the request', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'user-1', email: 'a@b.com', role: 'user' } })
    global.fetch = vi.fn(async () => new Response(new ReadableStream(), { status: 200 })) as unknown as typeof fetch

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/agent', { method: 'POST', body: JSON.stringify({ message: 'hi' }) })
    await POST(req)

    expect(recordSpend).toHaveBeenCalledWith({}, 'user-1', 'global')
  })

  it('does not record spend when the gateway call fails', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'user-1', email: 'a@b.com', role: 'user' } })
    global.fetch = vi.fn(async () => new Response('gateway down', { status: 500 })) as unknown as typeof fetch

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/agent', { method: 'POST', body: JSON.stringify({ message: 'hi' }) })
    const res = await POST(req)

    expect(res.status).toBe(500)
    expect(recordSpend).not.toHaveBeenCalled()
  })

  it('drops a trailing history turn that duplicates the current message', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'user-1', email: 'a@b.com', role: 'user' } })
    fetchRecentTurns.mockResolvedValue([
      { role: 'user', text: 'earlier question', imageUrls: [], createdAt: '2026-01-01' },
      { role: 'assistant', text: 'earlier answer', imageUrls: [], createdAt: '2026-01-01' },
      { role: 'user', text: 'current question', imageUrls: [], createdAt: '2026-01-02' },
    ])

    let capturedBody: Record<string, unknown> | null = null
    global.fetch = vi.fn(async (_url, init) => {
      capturedBody = JSON.parse((init as RequestInit).body as string)
      return new Response(new ReadableStream(), { status: 200 })
    }) as unknown as typeof fetch

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      body: JSON.stringify({ message: 'current question' }),
    })
    await POST(req)

    expect(capturedBody).not.toBeNull()
    expect((capturedBody as unknown as { history: unknown[] }).history).toEqual([
      { role: 'user', text: 'earlier question' },
      { role: 'assistant', text: 'earlier answer' },
    ])
  })

  it('replaces empty-text image-only history turns with a placeholder', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'user-1', email: 'a@b.com', role: 'user' } })
    fetchRecentTurns.mockResolvedValue([
      { role: 'user', text: '', imageUrls: ['https://r2.example.com/x.png'], createdAt: '2026-01-01' },
    ])

    let capturedBody: Record<string, unknown> | null = null
    global.fetch = vi.fn(async (_url, init) => {
      capturedBody = JSON.parse((init as RequestInit).body as string)
      return new Response(new ReadableStream(), { status: 200 })
    }) as unknown as typeof fetch

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      body: JSON.stringify({ message: 'new question' }),
    })
    await POST(req)

    expect((capturedBody as unknown as { history: { role: string; text: string }[] }).history).toEqual([
      { role: 'user', text: '[用户发送了一张图片]' },
    ])
  })
})
