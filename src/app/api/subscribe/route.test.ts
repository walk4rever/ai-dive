import crypto from 'crypto'
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendEmail = vi.fn()
const single = vi.fn()
const upsert = vi.fn()
const select = vi.fn()
const eq = vi.fn()
const from = vi.fn()
const createServiceClient = vi.fn()

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: sendEmail,
    },
  })),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient,
}))

describe('POST /api/subscribe', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://aipulse.test')
    vi.stubEnv('EMAIL_CONFIRMATION_SECRET', 'confirmation-secret')
    vi.stubEnv('RESEND_API_KEY', 'resend-key')
    vi.stubEnv('RESEND_FROM_NAME', 'AI-DIVE')
    vi.stubEnv('RESEND_FROM_EMAIL', 'hi@aipulse.test')

    eq.mockReturnValue({ single })
    select.mockReturnValue({ eq })
    upsert.mockResolvedValue({ error: null })
    from.mockImplementation((table: string) => {
      if (table === 'ai_pulse_subscribers') {
        return { select, upsert }
      }

      throw new Error(`Unexpected table: ${table}`)
    })
    createServiceClient.mockResolvedValue({ from })
  })

  it('rejects invalid emails', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email: 'bad-email' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: '请输入有效的邮箱地址。' })
  })

  it('returns conflict for already confirmed subscribers', async () => {
    single.mockResolvedValue({
      data: {
        id: '1',
        status: 'active',
        confirmed_at: '2026-03-28T00:00:00.000Z',
      },
    })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email: 'reader@example.com' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)

    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toEqual({ error: '该邮箱已订阅。' })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('resends confirmation for unconfirmed subscribers', async () => {
    single.mockResolvedValue({ data: { id: '1', status: 'pending', confirmed_at: null } })
    sendEmail.mockResolvedValue({ data: { id: 'email_1' }, error: null })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email: 'reader@example.com', name: 'Rafael' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.message).toBe('确认邮件已重新发送，请查收并点击确认链接。')
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'reader@example.com',
        status: 'pending',
        confirmation_nonce_hash: expect.any(String),
        confirmation_expires_at: expect.any(String),
      }),
      { onConflict: 'email' }
    )
  })

  it('allows resubscribe for unsubscribed readers', async () => {
    single.mockResolvedValue({ data: { id: '1', status: 'unsubscribed', confirmed_at: null } })
    sendEmail.mockResolvedValue({ data: { id: 'email_1' }, error: null })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email: 'reader@example.com' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.message).toBe('确认邮件已发送，请查收并点击确认链接。')
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending',
        unsubscribed_at: null,
        confirmed_at: null,
      }),
      { onConflict: 'email' }
    )
  })

  it('returns 502 when email sending fails', async () => {
    single.mockResolvedValue({ data: null })
    sendEmail.mockResolvedValue({ data: null, error: { message: 'provider down' } })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email: 'reader@example.com' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)

    expect(res.status).toBe(502)
    await expect(res.json()).resolves.toEqual({
      error: '确认邮件发送失败，请稍后重试。',
    })
  })

  it('rotates the confirmation nonce on every send', async () => {
    single.mockResolvedValue({ data: null })
    sendEmail.mockResolvedValue({ data: { id: 'email_1' }, error: null })

    const randomBytesSpy = vi
      .spyOn(crypto, 'randomBytes')
      .mockImplementationOnce(() => Buffer.from('nonce-1') as never)
      .mockImplementationOnce(() => Buffer.from('nonce-2') as never)

    const { POST } = await import('./route')

    const firstReq = new NextRequest('http://localhost/api/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email: 'reader@example.com' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const secondReq = new NextRequest('http://localhost/api/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email: 'reader@example.com' }),
      headers: { 'Content-Type': 'application/json' },
    })

    await POST(firstReq)
    await POST(secondReq)

    const firstHash = upsert.mock.calls[0]?.[0]?.confirmation_nonce_hash
    const secondHash = upsert.mock.calls[1]?.[0]?.confirmation_nonce_hash

    expect(firstHash).toBeTruthy()
    expect(secondHash).toBeTruthy()
    expect(firstHash).not.toBe(secondHash)

    randomBytesSpy.mockRestore()
  })
})
