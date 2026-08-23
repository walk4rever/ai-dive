import { describe, expect, it, vi } from 'vitest'
import { deriveContextKey, fetchRecentTurns } from './agent-context'
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
