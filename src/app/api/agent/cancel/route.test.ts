import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getServerSession = vi.fn()
const resolveAgentPageContext = vi.fn()

vi.mock('next-auth', () => ({ getServerSession }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/resolve-agent-context', () => ({ resolveAgentPageContext }))

const originalFetch = global.fetch

describe('POST /api/agent/cancel', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.AI_DIVE_AGENT_GATEWAY_URL = 'http://gateway.local'
    process.env.AI_DIVE_AGENT_SECRET = 'secret'
    getServerSession.mockResolvedValue({ user: { id: 'user-1', email: 'a@b.com', role: 'user' } })
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('forwards the resolved intel-day context to the gateway', async () => {
    resolveAgentPageContext.mockResolvedValue({
      context: { kind: 'intel_day', id: '2026-10-18' },
      contextKey: 'intel-day:2026-10-18',
    })
    let capturedBody: Record<string, unknown> | null = null
    global.fetch = vi.fn(async (_url, init) => {
      capturedBody = JSON.parse((init as RequestInit).body as string)
      return Response.json({ ok: true })
    }) as unknown as typeof fetch

    const { POST } = await import('./route')
    const res = await POST(new NextRequest('http://localhost/api/agent/cancel', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'web-session-1',
        pageContext: { kind: 'intel_day', id: '2026-10-18' },
      }),
    }))

    expect(res.status).toBe(200)
    expect(capturedBody).toMatchObject({
      userId: 'web-session-1',
      pageContext: { kind: 'intel_day', id: '2026-10-18' },
    })
    expect(capturedBody).not.toHaveProperty('articleSlug')
  })
})
