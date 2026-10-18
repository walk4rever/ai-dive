import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getServerSession = vi.fn()
const createServiceClient = vi.fn()

vi.mock('next-auth', () => ({ getServerSession }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient }))

function req() {
  return new NextRequest('http://localhost/api/orders/order-1', { method: 'DELETE' })
}

function fakeSupabase(
  order: { id: string; status: string } | null,
  options: { lookupError?: { message: string }; updateError?: { message: string } } = {}
) {
  const updates: Record<string, unknown>[] = []

  const supabase = {
    from: () => ({
      select: () => {
        const builder = {
          eq: () => builder,
          maybeSingle: async () => ({ data: order, error: options.lookupError ?? null }),
        }
        return builder
      },
      update: (patch: Record<string, unknown>) => {
        updates.push(patch)
        const chain = {
          eq: () => chain,
          then: (resolve: (value: { error: unknown }) => void) =>
            resolve({ error: options.updateError ?? null }),
        }
        return chain
      },
    }),
  }

  return { supabase, updates }
}

async function callDelete() {
  const { DELETE } = await import('./route')
  return DELETE(req(), { params: Promise.resolve({ id: 'order-1' }) })
}

describe('DELETE /api/orders/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getServerSession.mockResolvedValue({ user: { id: 'user-1' } })
  })

  it('rejects unauthenticated requests', async () => {
    getServerSession.mockResolvedValue(null)
    createServiceClient.mockResolvedValue(fakeSupabase(null).supabase)

    const res = await callDelete()
    expect(res.status).toBe(401)
  })

  it('returns 404 for an order the caller does not own', async () => {
    createServiceClient.mockResolvedValue(fakeSupabase(null).supabase)

    const res = await callDelete()
    expect(res.status).toBe(404)
  })

  it('hides a paid order without changing its payment status', async () => {
    const { supabase, updates } = fakeSupabase({ id: 'order-1', status: 'paid' })
    createServiceClient.mockResolvedValue(supabase)

    const res = await callDelete()

    expect(res.status).toBe(200)
    expect(updates[0]).toEqual({ user_deleted_at: expect.any(String) })
  })

  it('cancels a pending order as part of removing it', async () => {
    const { supabase, updates } = fakeSupabase({ id: 'order-1', status: 'pending' })
    createServiceClient.mockResolvedValue(supabase)

    const res = await callDelete()

    expect(res.status).toBe(200)
    expect(updates[0]).toMatchObject({
      status: 'cancelled',
      cancel_reason: 'user',
      user_deleted_at: expect.any(String),
    })
  })

  it('returns 500 when the update fails', async () => {
    const { supabase } = fakeSupabase(
      { id: 'order-1', status: 'paid' },
      { updateError: { message: 'db down' } }
    )
    createServiceClient.mockResolvedValue(supabase)

    const res = await callDelete()
    expect(res.status).toBe(500)
  })
})
