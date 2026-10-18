import { describe, expect, it, vi } from 'vitest'
import {
  agentPageContextKey,
  deriveContextKey,
  fetchRecentTurns,
  parseAgentPageContext,
} from './agent-context'
import type { SupabaseClient } from '@supabase/supabase-js'

describe('deriveContextKey', () => {
  it('returns "global" for missing/empty input', () => {
    expect(deriveContextKey(undefined)).toBe('global')
    expect(deriveContextKey(null)).toBe('global')
    expect(deriveContextKey('')).toBe('global')
    expect(deriveContextKey('   ')).toBe('global')
  })

  it('trims and returns the slug as-is', () => {
    expect(deriveContextKey('  my-article  ')).toBe('my-article')
  })
})

describe('agent page context', () => {
  it('keys intel-day conversations by date', () => {
    expect(agentPageContextKey({ kind: 'intel_day', id: '2026-10-18' })).toBe('intel-day:2026-10-18')
    expect(agentPageContextKey({ kind: 'article', id: 'my-article' })).toBe('my-article')
    expect(agentPageContextKey()).toBe('global')
  })

  it('parses and validates supported page contexts', () => {
    expect(parseAgentPageContext({ kind: 'intel_day', id: '2026-10-18' })).toEqual({
      kind: 'intel_day',
      id: '2026-10-18',
    })
    expect(parseAgentPageContext({ kind: 'intel_day', id: '2026-02-31' })).toBeNull()
    expect(parseAgentPageContext({ kind: 'article', id: '  post-slug  ' })).toEqual({
      kind: 'article',
      id: 'post-slug',
    })
    expect(parseAgentPageContext({ kind: 'unknown', id: 'x' })).toBeNull()
  })
})

describe('fetchRecentTurns', () => {
  function mockSupabase(data: unknown, error: unknown = null) {
    const limit = vi.fn().mockResolvedValue({ data, error })
    const order = vi.fn(() => ({ limit }))
    const eq2 = vi.fn(() => ({ order }))
    const eq1 = vi.fn(() => ({ eq: eq2 }))
    const select = vi.fn(() => ({ eq: eq1 }))
    const from = vi.fn(() => ({ select }))
    return { from } as unknown as SupabaseClient
  }

  it('returns turns oldest-first', async () => {
    const supabase = mockSupabase([
      { role: 'assistant', text: 'b', image_urls: [], created_at: '2026-01-02' },
      { role: 'user', text: 'a', image_urls: null, created_at: '2026-01-01' },
    ])

    const result = await fetchRecentTurns(supabase, 'user-1', 'global')

    expect(result).toEqual([
      { role: 'user', text: 'a', imageUrls: [], createdAt: '2026-01-01' },
      { role: 'assistant', text: 'b', imageUrls: [], createdAt: '2026-01-02' },
    ])
  })

  it('returns an empty array on query error', async () => {
    const supabase = mockSupabase(null, new Error('boom'))
    expect(await fetchRecentTurns(supabase, 'user-1', 'global')).toEqual([])
  })
})
