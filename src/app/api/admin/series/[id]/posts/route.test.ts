import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const from = vi.fn()
const createServiceClient = vi.fn()
const requireAdminSession = vi.fn()

vi.mock('@/lib/supabase/server', () => ({ createServiceClient }))
vi.mock('@/lib/admin-auth', () => ({ requireAdminSession }))

type QueryBuilder = {
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
}

function builder() {
  const query = {} as QueryBuilder
  query.select = vi.fn(() => query)
  query.eq = vi.fn(() => query)
  query.order = vi.fn(() => query)
  query.limit = vi.fn(() => query)
  query.single = vi.fn()
  query.maybeSingle = vi.fn()
  query.update = vi.fn(() => query)
  return query
}

function postRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/series/topic-1/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('admin series posts API', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    requireAdminSession.mockResolvedValue(true)
  })

  it('rejects an unauthenticated request', async () => {
    requireAdminSession.mockResolvedValue(false)

    const { POST } = await import('./route')
    const res = await POST(postRequest({ post_id: 'story-1' }), {
      params: Promise.resolve({ id: 'topic-1' }),
    })

    expect(res.status).toBe(401)
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it('adds a story to the end of the topic', async () => {
    const storyBuilder = builder()
    storyBuilder.single.mockResolvedValue({
      data: { id: 'story-1', topic_id: null },
      error: null,
    })
    const orderBuilder = builder()
    orderBuilder.maybeSingle.mockResolvedValue({
      data: { topic_order: 4 },
      error: null,
    })
    const updateBuilder = builder()
    updateBuilder.eq.mockResolvedValue({ error: null })

    from
      .mockReturnValueOnce(storyBuilder)
      .mockReturnValueOnce(orderBuilder)
      .mockReturnValueOnce(updateBuilder)
    createServiceClient.mockResolvedValue({ from })

    const { POST } = await import('./route')
    const res = await POST(postRequest({ post_id: 'story-1' }), {
      params: Promise.resolve({ id: 'topic-1' }),
    })

    expect(res.status).toBe(201)
    expect(updateBuilder.update).toHaveBeenCalledWith({
      topic_id: 'topic-1',
      topic_order: 5,
    })
  })

  it('rejects a story that already belongs to another topic', async () => {
    const storyBuilder = builder()
    storyBuilder.single.mockResolvedValue({
      data: { id: 'story-1', topic_id: 'topic-2' },
      error: null,
    })
    from.mockReturnValueOnce(storyBuilder)
    createServiceClient.mockResolvedValue({ from })

    const { POST } = await import('./route')
    const res = await POST(postRequest({ post_id: 'story-1' }), {
      params: Promise.resolve({ id: 'topic-1' }),
    })

    expect(res.status).toBe(409)
    expect(from).toHaveBeenCalledTimes(1)
  })

  it('validates the story id', async () => {
    const { POST } = await import('./route')
    const res = await POST(postRequest({}), {
      params: Promise.resolve({ id: 'topic-1' }),
    })

    expect(res.status).toBe(422)
    expect(createServiceClient).not.toHaveBeenCalled()
  })
})
