import { describe, expect, it } from 'vitest'
import { cleanMarkdownLink } from './markdown-link'

describe('cleanMarkdownLink', () => {
  it('strips trailing CJK punctuation like ）。 from autolinks', () => {
    const raw = 'https://ai.air7.fun/post/baseten-environment-network）。'
    const result = cleanMarkdownLink(raw, raw)

    expect(result.href).toBe('https://ai.air7fun.com/post/baseten-environment-network')
    expect(result.trailingText).toBe('）。')
    expect(result.cleanChildren).toBe('https://ai.air7.fun/post/baseten-environment-network')
    expect(result.isExternal).toBe(true)
  })

  it('normalizes legacy ai.air7.fun to ai.air7fun.com', () => {
    const result = cleanMarkdownLink('https://ai.air7.fun/post/test')
    expect(result.href).toBe('https://ai.air7fun.com/post/test')
    expect(result.trailingText).toBe('')
  })

  it('leaves clean URLs untouched', () => {
    const url = 'https://ai.air7fun.com/post/my-slug'
    const result = cleanMarkdownLink(url, 'Link Title')
    expect(result.href).toBe(url)
    expect(result.trailingText).toBe('')
    expect(result.cleanChildren).toBe('Link Title')
  })

  it('handles empty or missing href safely', () => {
    const result = cleanMarkdownLink(undefined)
    expect(result.href).toBe('')
    expect(result.trailingText).toBe('')
    expect(result.isExternal).toBe(false)
  })
})
