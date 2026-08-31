import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getServerSession = vi.fn()
const createServiceClient = vi.fn()
const from = vi.fn()

vi.mock('next-auth', () => ({ getServerSession }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/supabase/server', () => ({ createServiceClient }))

function patchReq(body: unknown) {
  return new NextRequest('http://localhost/api/admin/users/target-id', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function deleteReq() {
  return new NextRequest('http://localhost/api/admin/users/target-id', { method: 'DELETE' })
}

type QueryBuilder = {
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
}

function mockBuilder(result: { error: unknown } = { error: null }) {
  const builder = {} as QueryBuilder
  builder.update = vi.fn(() => builder)
  builder.delete = vi.fn(() => builder)
  builder.eq = vi.fn().mockResolvedValue(result)
  from.mockReturnValue(builder)
  createServiceClient.mockResolvedValue({ from })
  return builder
}

describe('PATCH /api/admin/users/[id]', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('rejects a non-admin session', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'admin-1', role: 'user' } })

    const { PATCH } = await import('./route')
    const res = await PATCH(patchReq({ role: 'admin' }), { params: Promise.resolve({ id: 'target-id' }) })

    expect(res.status).toBe(401)
    expect(from).not.toHaveBeenCalled()
  })

  it('rejects a missing session', async () => {
    getServerSession.mockResolvedValue(null)

    const { PATCH } = await import('./route')
    const res = await PATCH(patchReq({ role: 'admin' }), { params: Promise.resolve({ id: 'target-id' }) })

    expect(res.status).toBe(401)
  })

  it('rejects a role outside user/admin', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } })
    mockBuilder()

    const { PATCH } = await import('./route')
    const res = await PATCH(patchReq({ role: 'superadmin' }), { params: Promise.resolve({ id: 'target-id' }) })

    expect(res.status).toBe(422)
    expect(from).not.toHaveBeenCalled()
  })

  it('promotes another user to admin', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } })
    const builder = mockBuilder()

    const { PATCH } = await import('./route')
    const res = await PATCH(patchReq({ role: 'admin' }), { params: Promise.resolve({ id: 'target-id' }) })

    expect(res.status).toBe(200)
    expect(builder.update).toHaveBeenCalledWith({ role: 'admin' })
    expect(builder.eq).toHaveBeenCalledWith('id', 'target-id')
  })

  it('demotes another user from admin to user', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } })
    const builder = mockBuilder()

    const { PATCH } = await import('./route')
    const res = await PATCH(patchReq({ role: 'user' }), { params: Promise.resolve({ id: 'target-id' }) })

    expect(res.status).toBe(200)
    expect(builder.update).toHaveBeenCalledWith({ role: 'user' })
  })

  it('blocks an admin from demoting themselves', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } })
    mockBuilder()

    const { PATCH } = await import('./route')
    const res = await PATCH(patchReq({ role: 'user' }), { params: Promise.resolve({ id: 'admin-1' }) })

    expect(res.status).toBe(422)
    expect(from).not.toHaveBeenCalled()
  })

  it('allows an admin to "promote" themselves to admin (a no-op, not a demotion)', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } })
    const builder = mockBuilder()

    const { PATCH } = await import('./route')
    const res = await PATCH(patchReq({ role: 'admin' }), { params: Promise.resolve({ id: 'admin-1' }) })

    expect(res.status).toBe(200)
    expect(builder.update).toHaveBeenCalledWith({ role: 'admin' })
  })

  it('returns a 500 with the database error message on failure', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } })
    mockBuilder({ error: { message: 'boom' } })

    const { PATCH } = await import('./route')
    const res = await PATCH(patchReq({ role: 'admin' }), { params: Promise.resolve({ id: 'target-id' }) })
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.error).toBe('boom')
  })
})

describe('DELETE /api/admin/users/[id]', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('rejects a non-admin session', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'admin-1', role: 'user' } })

    const { DELETE } = await import('./route')
    const res = await DELETE(deleteReq(), { params: Promise.resolve({ id: 'target-id' }) })

    expect(res.status).toBe(401)
    expect(from).not.toHaveBeenCalled()
  })

  it('blocks an admin from deleting their own account', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } })
    mockBuilder()

    const { DELETE } = await import('./route')
    const res = await DELETE(deleteReq(), { params: Promise.resolve({ id: 'admin-1' }) })

    expect(res.status).toBe(422)
    expect(from).not.toHaveBeenCalled()
  })

  it('deletes another user', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } })
    const builder = mockBuilder()

    const { DELETE } = await import('./route')
    const res = await DELETE(deleteReq(), { params: Promise.resolve({ id: 'target-id' }) })

    expect(res.status).toBe(200)
    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('id', 'target-id')
  })

  it('surfaces a specific 409 when the user has authored stories (FK violation)', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } })
    mockBuilder({ error: { code: '23503', message: 'foreign key violation' } })

    const { DELETE } = await import('./route')
    const res = await DELETE(deleteReq(), { params: Promise.resolve({ id: 'target-id' }) })
    const data = await res.json()

    expect(res.status).toBe(409)
    expect(data.error).toContain('发布过文章')
  })

  it('returns a 500 with the database error message for any other failure', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } })
    mockBuilder({ error: { code: 'XXOOO', message: 'boom' } })

    const { DELETE } = await import('./route')
    const res = await DELETE(deleteReq(), { params: Promise.resolve({ id: 'target-id' }) })
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.error).toBe('boom')
  })
})
