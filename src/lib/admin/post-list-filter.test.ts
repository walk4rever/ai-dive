import { describe, expect, it } from 'vitest'
import { matchesPostListStatus } from './post-list-filter'

describe('matchesPostListStatus', () => {
  it('matches every post for the all filter', () => {
    expect(matchesPostListStatus({ status: 'draft', featured: false }, 'all')).toBe(true)
  })

  it('matches draft and published status filters', () => {
    expect(matchesPostListStatus({ status: 'draft', featured: false }, 'draft')).toBe(true)
    expect(matchesPostListStatus({ status: 'published', featured: false }, 'published')).toBe(true)
    expect(matchesPostListStatus({ status: 'draft', featured: false }, 'published')).toBe(false)
  })

  it('matches featured posts regardless of publication status', () => {
    expect(matchesPostListStatus({ status: 'published', featured: true }, 'featured')).toBe(true)
    expect(matchesPostListStatus({ status: 'draft', featured: true }, 'featured')).toBe(true)
    expect(matchesPostListStatus({ status: 'published', featured: false }, 'featured')).toBe(false)
  })
})
