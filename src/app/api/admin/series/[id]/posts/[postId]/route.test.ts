import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const from = vi.fn()
const rpc = vi.fn()
const createServiceClient = vi.fn()
const requireAdminSession = vi.fn()

vi.mock('@/lib/supabase/server', () => ({ createServiceClient }))
vi.mock('@/lib/admin-auth', () => ({ requireAdminSession }))

type QueryBuilder = {
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
}

function builder() {
  const query = {} as QueryBuilder
  query.select = vi.fn(() => query)
  query.eq = vi.fn(() => query)
  query.single = vi.fn()
  query.update = vi.fn(() => query)
  return query
}

function patchRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/series/topic-1/posts/story-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('admin series post detail API', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    requireAdminSession.mockResolvedValue(true)
  })

  it('removes a story from its topic and clears its order', async () => {
    const storyBuilder = builder()
    storyBuilder.single.mockResolvedValue({
      data: { id: 'story-1', topic_id: 'topic-1' },
      error: null,
    })
    const updateBuilder = builder()
    updateBuilder.eq.mockResolvedValue({ error: null })
    from.mockReturnValueOnce(storyBuilder).mockReturnValueOnce(updateBuilder)
    createServiceClient.mockResolvedValue({ from })

    const { DELETE } = await import('./route')
    const res = await DELETE(
      new NextRequest('http://localhost/api/admin/series/topic-1/posts/story-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'topic-1', postId: 'story-1' }) }
    )

    expect(res.status).toBe(200)
    expect(updateBuilder.update).toHaveBeenCalledWith({ topic_id: null, topic_order: null })
  })

  it('refuses to remove a story from a topic it does not belong to', async () => {
    const storyBuilder = builder()
    storyBuilder.single.mockResolvedValue({
      data: { id: 'story-1', topic_id: 'topic-2' },
      error: null,
    })
    from.mockReturnValueOnce(storyBuilder)
    createServiceClient.mockResolvedValue({ from })

    const { DELETE } = await import('./route')
    const res = await DELETE(
      new NextRequest('http://localhost/api/admin/series/topic-1/posts/story-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'topic-1', postId: 'story-1' }) }
    )

    expect(res.status).toBe(404)
  })

  it('validates the direction before calling the database', async () => {
    const { PATCH } = await import('./route')
    const res = await PATCH(patchRequest({ direction: 'sideways' }), {
      params: Promise.resolve({ id: 'topic-1', postId: 'story-1' }),
    })

    expect(res.status).toBe(422)
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it('moves a story through the database function', async () => {
    rpc.mockResolvedValue({ error: null })
    createServiceClient.mockResolvedValue({ rpc })

    const { PATCH } = await import('./route')
    const res = await PATCH(patchRequest({ direction: 'up' }), {
      params: Promise.resolve({ id: 'topic-1', postId: 'story-1' }),
    })

    expect(res.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('move_topic_story', {
      p_topic_id: 'topic-1',
      p_story_id: 'story-1',
      p_direction: 'up',
    })
  })

  it('rejects an unauthenticated reorder request', async () => {
    requireAdminSession.mockResolvedValue(false)

    const { PATCH } = await import('./route')
    const res = await PATCH(patchRequest({ direction: 'up' }), {
      params: Promise.resolve({ id: 'topic-1', postId: 'story-1' }),
    })

    expect(res.status).toBe(401)
    expect(createServiceClient).not.toHaveBeenCalled()
  })
})
