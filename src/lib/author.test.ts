import { describe, expect, it } from 'vitest'
import { toAuthorDisplay, toAuthorSlug } from './author'

describe('author identity helpers', () => {
  it('creates stable slugs from display names', () => {
    expect(toAuthorSlug('Latent Space')).toBe('latent-space')
    expect(toAuthorSlug('x@waterloo_intern')).toBe('x-waterloo-intern')
  })

  it('preserves known brand display names', () => {
    expect(toAuthorDisplay('20vc')).toBe('20VC')
    expect(toAuthorDisplay('twiml-ai')).toBe('TWIML AI')
    expect(toAuthorDisplay('leopold-aschenbrenner')).toBe('Leopold Aschenbrenner')
  })
})
