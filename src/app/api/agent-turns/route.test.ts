import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getServerSession = vi.fn()
const createServiceClient = vi.fn()
const uploadBase64ToR2 = vi.fn()

vi.mock('next-auth', () => ({ getServerSession }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient }))
vi.mock('@/lib/r2', () => ({ uploadBase64ToR2 }))

function mockSupabaseInsert(error: unknown = null) {
  const insert = vi.fn().mockResolvedValue({ error })
  const from = vi.fn(() => ({ insert }))
  return { from, insert }
}

function mockSupabaseSelect(data: unknown) {
  const limit = vi.fn().mockResolvedValue({ data, error: null })
  const order = vi.fn(() => ({ limit }))
  const eq2 = vi.fn(() => ({ order }))
  const eq1 = vi.fn(() => ({ eq: eq2 }))
  const select = vi.fn(() => ({ eq: eq1 }))
  const from = vi.fn(() => ({ select }))
  return { from }
}

describe('/api/agent-turns', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  describe('GET', () => {
    it('rejects unauthenticated requests', async () => {
      getServerSession.mockResolvedValue(null)
      const { GET } = await import('./route')
      const res = await GET(new NextRequest('http://localhost/api/agent-turns?contextKey=global'))
      expect(res.status).toBe(401)
    })

    it('returns turns oldest-first for the session user', async () => {
      getServerSession.mockResolvedValue({ user: { id: 'user-1', email: 'a@b.com', role: 'user' } })
      const client = mockSupabaseSelect([
        { role: 'assistant', text: 'b', image_urls: [], created_at: '2026-01-02' },
        { role: 'user', text: 'a', image_urls: [], created_at: '2026-01-01' },
      ])
      createServiceClient.mockResolvedValue(client)

      const { GET } = await import('./route')
      const res = await GET(
        new NextRequest('http://localhost/api/agent-turns?contextKey=global', {
          headers: { Authorization: 'Bearer tok' },
        })
      )
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.turns).toEqual([
        { role: 'user', text: 'a', imageUrls: [], createdAt: '2026-01-01' },
        { role: 'assistant', text: 'b', imageUrls: [], createdAt: '2026-01-02' },
      ])
    })
  })

  describe('POST', () => {
    beforeEach(() => {
      getServerSession.mockResolvedValue({ user: { id: 'user-1', email: 'a@b.com', role: 'user' } })
    })

    it('rejects unauthenticated requests', async () => {
      getServerSession.mockResolvedValue(null)
      const { POST } = await import('./route')
      const req = new NextRequest('http://localhost/api/agent-turns', { method: 'POST', body: '{}' })
      const res = await POST(req)
      expect(res.status).toBe(401)
      expect(createServiceClient).not.toHaveBeenCalled()
    })

    it('rejects a turn with no text and no images', async () => {
      const { POST } = await import('./route')
      const req = new NextRequest('http://localhost/api/agent-turns', {
        method: 'POST',
        headers: { Authorization: 'Bearer tok' },
        body: JSON.stringify({ role: 'user', text: '' }),
      })
      const res = await POST(req)
      expect(res.status).toBe(422)
    })

    it('accepts a pure-image message (empty text, non-empty images)', async () => {
      uploadBase64ToR2.mockResolvedValue('https://r2.example.com/users/user-1/chat/x.png')
      const { from, insert } = mockSupabaseInsert()
      createServiceClient.mockResolvedValue({ from })

      const { POST } = await import('./route')
      const req = new NextRequest('http://localhost/api/agent-turns', {
        method: 'POST',
        headers: { Authorization: 'Bearer tok' },
        body: JSON.stringify({
          role: 'user',
          text: '',
          images: [{ mimeType: 'image/png', data: 'abc123' }],
        }),
      })
      const res = await POST(req)

      expect(res.status).toBe(200)
      expect(uploadBase64ToR2).toHaveBeenCalledWith('user-1', 'chat', { mimeType: 'image/png', data: 'abc123' })
      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          context_key: 'global',
          role: 'user',
          text: '',
          image_urls: ['https://r2.example.com/users/user-1/chat/x.png'],
        })
      )
    })

    it('stores a text-only turn under the derived context key', async () => {
      const { from, insert } = mockSupabaseInsert()
      createServiceClient.mockResolvedValue({ from })

      const { POST } = await import('./route')
      const req = new NextRequest('http://localhost/api/agent-turns', {
        method: 'POST',
        headers: { Authorization: 'Bearer tok' },
        body: JSON.stringify({ role: 'assistant', text: '你好', contextKey: 'my-article' }),
      })
      const res = await POST(req)

      expect(res.status).toBe(200)
      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({ context_key: 'my-article', role: 'assistant', text: '你好', image_urls: [] })
      )
    })
  })
})
