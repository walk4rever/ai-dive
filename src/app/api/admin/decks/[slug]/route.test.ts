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

function patchRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/decks/k3-course', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/admin/decks/[slug]', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    requireAdminSession.mockResolvedValue(true)
  })

  function mockBuilder(result: { error: unknown } = { error: null }) {
    const builder = {} as QueryBuilder
    builder.update = vi.fn(() => builder)
    builder.eq = vi.fn().mockResolvedValue(result)
    from.mockReturnValue(builder)
    createServiceClient.mockResolvedValue({ from })
    return builder
  }

  it('rejects an unauthenticated request', async () => {
    requireAdminSession.mockResolvedValue(false)

    const { PATCH } = await import('./route')
    const res = await PATCH(patchRequest({ title: 'x' }), { params: Promise.resolve({ slug: 'k3-course' }) })

    expect(res.status).toBe(401)
  })

  it('converts a whole-yuan price to price_cents', async () => {
    const builder = mockBuilder()

    const { PATCH } = await import('./route')
    const res = await PATCH(patchRequest({ price: '19.9' }), { params: Promise.resolve({ slug: 'k3-course' }) })

    expect(res.status).toBe(200)
    expect(builder.update).toHaveBeenCalledWith({ price_cents: 1990 })
  })

  it('stores an explicit 0 price as NULL (free), not a literal 0', async () => {
    const builder = mockBuilder()

    const { PATCH } = await import('./route')
    const res = await PATCH(patchRequest({ price: 0 }), { params: Promise.resolve({ slug: 'k3-course' }) })

    expect(res.status).toBe(200)
    expect(builder.update).toHaveBeenCalledWith({ price_cents: null })
  })

  it('stores a blank price as NULL (free)', async () => {
    const builder = mockBuilder()

    const { PATCH } = await import('./route')
    const res = await PATCH(patchRequest({ price: '' }), { params: Promise.resolve({ slug: 'k3-course' }) })

    expect(res.status).toBe(200)
    expect(builder.update).toHaveBeenCalledWith({ price_cents: null })
  })

  it('rejects a negative price', async () => {
    mockBuilder()

    const { PATCH } = await import('./route')
    const res = await PATCH(patchRequest({ price: '-5' }), { params: Promise.resolve({ slug: 'k3-course' }) })

    expect(res.status).toBe(422)
    expect(from).not.toHaveBeenCalled()
  })

  it('rejects a kicker outside the fixed taxonomy', async () => {
    mockBuilder()

    const { PATCH } = await import('./route')
    const res = await PATCH(patchRequest({ kicker: 'CLICKBAIT' }), { params: Promise.resolve({ slug: 'k3-course' }) })

    expect(res.status).toBe(422)
  })

  it('rejects a blank title', async () => {
    mockBuilder()

    const { PATCH } = await import('./route')
    const res = await PATCH(patchRequest({ title: '   ' }), { params: Promise.resolve({ slug: 'k3-course' }) })

    expect(res.status).toBe(422)
  })

  it('rejects an invalid date', async () => {
    mockBuilder()

    const { PATCH } = await import('./route')
    const res = await PATCH(patchRequest({ date: 'not-a-date' }), { params: Promise.resolve({ slug: 'k3-course' }) })

    expect(res.status).toBe(422)
  })

  it('updates metadata fields together', async () => {
    const builder = mockBuilder()

    const { PATCH } = await import('./route')
    const res = await PATCH(
      patchRequest({ title: 'New Title', kicker: 'REPORT', status: 'published' }),
      { params: Promise.resolve({ slug: 'k3-course' }) }
    )

    expect(res.status).toBe(200)
    expect(builder.update).toHaveBeenCalledWith({ title: 'New Title', kicker: 'REPORT', status: 'published' })
  })

  it('never accepts href or slug in the update payload', async () => {
    const builder = mockBuilder()

    const { PATCH } = await import('./route')
    await PATCH(
      patchRequest({ title: 'New Title', href: '/hacked/', slug: 'hacked' }),
      { params: Promise.resolve({ slug: 'k3-course' }) }
    )

    expect(builder.update).toHaveBeenCalledWith({ title: 'New Title' })
  })

  it('returns a 500 with the database error message on failure', async () => {
    mockBuilder({ error: { message: 'boom' } })

    const { PATCH } = await import('./route')
    const res = await PATCH(patchRequest({ title: 'x' }), { params: Promise.resolve({ slug: 'k3-course' }) })
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.error).toBe('boom')
  })
})
