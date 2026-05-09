import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendEmail = vi.fn()
const single = vi.fn()
const postEq = vi.fn()
const postSelect = vi.fn()
const subscriberEq = vi.fn()
const subscriberOr = vi.fn()
const subscriberSelect = vi.fn()
const sendLogEq = vi.fn()
const sendLogSelect = vi.fn()
const insert = vi.fn()
const from = vi.fn()
const createServiceClient = vi.fn()
const requireAdminSession = vi.fn()

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

vi.mock('@/lib/admin-auth', () => ({
  requireAdminSession,
}))

describe('POST /api/admin/posts/[slug]/send', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://aipulse.test')
    vi.stubEnv('EMAIL_CONFIRMATION_SECRET', 'confirmation-secret')
    vi.stubEnv('RESEND_API_KEY', 'resend-key')
    vi.stubEnv('RESEND_FROM_NAME', 'AI-DIVE')
    vi.stubEnv('RESEND_FROM_EMAIL', 'hi@aipulse.test')

    requireAdminSession.mockResolvedValue(true)

    postEq.mockReturnValue({ single })
    postSelect.mockReturnValue({ eq: postEq })

    subscriberOr.mockResolvedValue({
      data: [
        { id: 'subscriber-1', email: 'reader1@example.com', name: 'Reader 1', status: 'active' },
        { id: 'subscriber-2', email: 'reader2@example.com', name: null, status: 'active' },
      ],
      error: null,
    })
    subscriberSelect.mockReturnValue({ or: subscriberOr, eq: subscriberEq })

    sendLogEq.mockResolvedValue({
      data: [{ subscriber_id: 'subscriber-2' }],
      error: null,
    })
    sendLogSelect.mockReturnValue({ eq: sendLogEq })

    insert.mockResolvedValue({ error: null })
    sendEmail.mockResolvedValue({ data: { id: 'email_1' }, error: null })

    from.mockImplementation((table: string) => {
      if (table === 'ai_pulse_stories') return { select: postSelect }
      if (table === 'ai_pulse_subscribers') return { select: subscriberSelect }
      if (table === 'ai_pulse_email_sends') return { select: sendLogSelect, insert }
      throw new Error(`Unexpected table: ${table}`)
    })

    createServiceClient.mockResolvedValue({ from })
  })

  it('rejects unauthorized requests', async () => {
    requireAdminSession.mockResolvedValue(false)
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/admin/posts/example/send', { method: 'POST' })

    const res = await POST(req, { params: Promise.resolve({ slug: 'example' }) })

    expect(res.status).toBe(401)
  })

  it('sends only to active unsent subscribers', async () => {
    single.mockResolvedValue({
      data: {
        id: 'post-1',
        slug: 'example',
        title: 'Example Post',
        excerpt: 'Fresh analysis.',
        status: 'published',
      },
      error: null,
    })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/admin/posts/example/send', { method: 'POST' })

    const res = await POST(req, { params: Promise.resolve({ slug: 'example' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(insert).toHaveBeenCalledWith({
      story_id: 'post-1',
      subscriber_id: 'subscriber-1',
    })
    expect(body).toEqual({
      ok: true,
      sent: 1,
      skipped: 1,
      failed: 0,
      failures: [],
    })
  })

  it('rejects draft posts', async () => {
    single.mockResolvedValue({
      data: {
        id: 'post-1',
        slug: 'example',
        title: 'Example Post',
        excerpt: 'Fresh analysis.',
        status: 'draft',
      },
      error: null,
    })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/admin/posts/example/send', { method: 'POST' })
    const res = await POST(req, { params: Promise.resolve({ slug: 'example' }) })

    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toEqual({ error: 'Only published posts can be sent' })
  })
})
