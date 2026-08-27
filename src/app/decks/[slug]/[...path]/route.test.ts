import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getServerSession = vi.fn()
const createServiceClient = vi.fn()
const canAccessDeck = vi.fn()
const fetchDeckObject = vi.fn()

vi.mock('next-auth', () => ({ getServerSession }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient }))
vi.mock('@/lib/decks/access', () => ({ canAccessDeck }))
vi.mock('@/lib/r2', () => ({ fetchDeckObject }))

describe('GET /decks/[slug]/[...path]', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    createServiceClient.mockResolvedValue({})
  })

  it('returns 403 without touching R2 when the requester lacks entitlement', async () => {
    getServerSession.mockResolvedValue(null)
    canAccessDeck.mockResolvedValue(false)

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/decks/k3-course/index.html')
    const res = await GET(req, { params: Promise.resolve({ slug: 'k3-course', path: ['index.html'] }) })

    expect(res.status).toBe(403)
    expect(fetchDeckObject).not.toHaveBeenCalled()
  })

  it('checks entitlement for asset requests too, not just the entry file', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'user-1' } })
    canAccessDeck.mockResolvedValue(false)

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/decks/k3-course/assets/hero.png')
    const res = await GET(req, {
      params: Promise.resolve({ slug: 'k3-course', path: ['assets', 'hero.png'] }),
    })

    expect(res.status).toBe(403)
    expect(canAccessDeck).toHaveBeenCalledWith({}, 'user-1', 'k3-course')
  })

  it('returns 404 when the object is missing from R2', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'user-1' } })
    canAccessDeck.mockResolvedValue(true)
    fetchDeckObject.mockResolvedValue(null)

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/decks/k3-course/missing.html')
    const res = await GET(req, { params: Promise.resolve({ slug: 'k3-course', path: ['missing.html'] }) })

    expect(res.status).toBe(404)
  })

  it('streams the object with its content type when entitled', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'user-1' } })
    canAccessDeck.mockResolvedValue(true)
    fetchDeckObject.mockResolvedValue({
      stream: new ReadableStream(),
      contentType: 'text/html; charset=utf-8',
    })

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/decks/k3-course/index.html')
    const res = await GET(req, { params: Promise.resolve({ slug: 'k3-course', path: ['index.html'] }) })

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
    expect(fetchDeckObject).toHaveBeenCalledWith('k3-course', 'index.html')
  })

  it('joins a multi-segment path back into the R2 relative key', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'user-1' } })
    canAccessDeck.mockResolvedValue(true)
    fetchDeckObject.mockResolvedValue({ stream: new ReadableStream(), contentType: 'image/png' })

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/decks/k3-course/assets/day-01/hero.png')
    await GET(req, { params: Promise.resolve({ slug: 'k3-course', path: ['assets', 'day-01', 'hero.png'] }) })

    expect(fetchDeckObject).toHaveBeenCalledWith('k3-course', 'assets/day-01/hero.png')
  })

  it('allows an anonymous request when the deck is unentitled-but-free', async () => {
    getServerSession.mockResolvedValue(null)
    canAccessDeck.mockResolvedValue(true)
    fetchDeckObject.mockResolvedValue({ stream: new ReadableStream(), contentType: 'text/html; charset=utf-8' })

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/decks/agent-harness/index.html')
    const res = await GET(req, { params: Promise.resolve({ slug: 'agent-harness', path: ['index.html'] }) })

    expect(res.status).toBe(200)
    expect(canAccessDeck).toHaveBeenCalledWith({}, null, 'agent-harness')
  })
})
