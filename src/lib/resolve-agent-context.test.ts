import { beforeEach, describe, expect, it, vi } from 'vitest'

const createClient = vi.fn()

vi.mock('@/lib/supabase/server', () => ({ createClient }))

function mockStoryLookup(data: { slug: string } | null) {
  const single = vi.fn().mockResolvedValue({ data })
  const eq3 = vi.fn(() => ({ single }))
  const eq2 = vi.fn(() => ({ eq: eq3 }))
  const eq1 = vi.fn(() => ({ eq: eq2 }))
  const select = vi.fn(() => ({ eq: eq1 }))
  const from = vi.fn(() => ({ select }))
  createClient.mockResolvedValue({ from })
}

describe('resolveAgentPageContext', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('accepts a valid intel date without querying the stories table', async () => {
    const { resolveAgentPageContext } = await import('./resolve-agent-context')
    const result = await resolveAgentPageContext({ kind: 'intel_day', id: '2026-10-18' })

    expect(result).toEqual({
      context: { kind: 'intel_day', id: '2026-10-18' },
      contextKey: 'intel-day:2026-10-18',
    })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('keeps article context keyed by the published slug', async () => {
    mockStoryLookup({ slug: 'published-article' })
    const { resolveAgentPageContext } = await import('./resolve-agent-context')
    const result = await resolveAgentPageContext({ kind: 'article', id: 'published-article' })

    expect(result).toEqual({
      context: { kind: 'article', id: 'published-article' },
      contextKey: 'published-article',
    })
  })

  it('rejects an article that is not published', async () => {
    mockStoryLookup(null)
    const { resolveAgentPageContext } = await import('./resolve-agent-context')

    expect(await resolveAgentPageContext({ kind: 'article', id: 'missing' })).toBeUndefined()
  })
})
