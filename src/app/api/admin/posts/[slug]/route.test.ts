import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const from = vi.fn()
const createServiceClient = vi.fn()
const requireAdminSession = vi.fn()

vi.mock('@/lib/supabase/server', () => ({ createServiceClient }))
vi.mock('@/lib/admin-auth', () => ({ requireAdminSession }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

type QueryBuilder = {
  update: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
}

describe('admin post detail API', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    requireAdminSession.mockResolvedValue(true)
  })

  it('updates markdown and rendered HTML together', async () => {
    const builder = {} as QueryBuilder
    builder.update = vi.fn(() => builder)
    builder.eq = vi.fn().mockResolvedValue({ error: null })
    from.mockReturnValue(builder)
    createServiceClient.mockResolvedValue({ from })

    const { PATCH } = await import('./route')
    const req = new NextRequest('http://localhost/api/admin/posts/sample', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer admin-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '**updated**', status: 'draft' }),
    })

    const res = await PATCH(req, { params: Promise.resolve({ slug: 'sample' }) })

    expect(res.status).toBe(200)
    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({
      body_markdown: '**updated**',
      content: expect.stringContaining('<strong>updated</strong>'),
      status: 'draft',
    }))
  })
})
