import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const from = vi.fn()
const createServiceClient = vi.fn()
const requireAdminSession = vi.fn()

vi.mock('@/lib/supabase/server', () => ({ createServiceClient }))
vi.mock('@/lib/admin-auth', () => ({ requireAdminSession }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

type QueryBuilder = {
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
}

describe('admin posts API', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    requireAdminSession.mockResolvedValue(true)
  })

  it('creates a draft with markdown and rendered HTML', async () => {
    const builder = {} as QueryBuilder
    builder.select = vi.fn(() => builder)
    builder.eq = vi.fn(() => builder)
    builder.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    builder.insert = vi.fn(() => builder)
    builder.single = vi.fn().mockResolvedValue({ data: { slug: 'new-dive' }, error: null })
    from.mockReturnValue(builder)
    createServiceClient.mockResolvedValue({ from })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/admin/posts', {
      method: 'POST',
      headers: { Authorization: 'Bearer admin-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: 'new-dive',
        title: 'New Dive',
        content: '# Hello',
        content_type: 'dive',
        status: 'draft',
        author_display: 'Latent Space',
      }),
    })

    const res = await POST(req)

    expect(res.status).toBe(201)
    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({
      body_markdown: '# Hello',
      author_slug: 'latent-space',
      author_display: 'Latent Space',
      status: 'draft',
      published_at: null,
    }))
  })

  it('rejects unauthenticated create requests', async () => {
    requireAdminSession.mockResolvedValue(false)
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/admin/posts', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(401)
    expect(createServiceClient).not.toHaveBeenCalled()
  })
})
