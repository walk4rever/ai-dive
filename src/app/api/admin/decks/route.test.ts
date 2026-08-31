import { beforeEach, describe, expect, it, vi } from 'vitest'

const from = vi.fn()
const createServiceClient = vi.fn()
const requireAdminSession = vi.fn()

vi.mock('@/lib/supabase/server', () => ({ createServiceClient }))
vi.mock('@/lib/admin-auth', () => ({ requireAdminSession }))

describe('GET /api/admin/decks', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('rejects an unauthenticated request', async () => {
    requireAdminSession.mockResolvedValue(false)

    const { GET } = await import('./route')
    const res = await GET()

    expect(res.status).toBe(401)
    expect(from).not.toHaveBeenCalled()
  })

  it('returns every deck regardless of status', async () => {
    requireAdminSession.mockResolvedValue(true)
    const builder = {
      select: vi.fn(() => builder),
      order: vi.fn().mockResolvedValue({
        data: [
          { id: '1', slug: 'a', href: '/decks/a/', title: 'A', kicker: 'PLAYBOOK', description: 'd', meta: 'm', date: '2026-01-01', status: 'draft', price_cents: null, currency: 'CNY' },
        ],
        error: null,
      }),
    }
    from.mockReturnValue(builder)
    createServiceClient.mockResolvedValue({ from })

    const { GET } = await import('./route')
    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.decks).toHaveLength(1)
    expect(data.decks[0].status).toBe('draft')
  })
})
