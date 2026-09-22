import { describe, expect, it } from 'vitest'
import { stripWikilinks, toAuthorDisplay, toAuthorSlug } from './author'

describe('author identity helpers', () => {
  it('creates stable slugs from display names', () => {
    expect(toAuthorSlug('Latent Space')).toBe('latent-space')
    expect(toAuthorSlug('x@waterloo_intern')).toBe('x-waterloo-intern')
  })

  it('preserves known brand display names', () => {
    expect(toAuthorDisplay('20vc')).toBe('20VC')
    expect(toAuthorDisplay('twiml-ai')).toBe('TWIML AI')
    expect(toAuthorDisplay('leopold-aschenbrenner')).toBe('Leopold Aschenbrenner')
    expect(toAuthorDisplay('rafa')).toBe('RAFA')
    expect(toAuthorDisplay('r129')).toBe('R129')
  })

  it('keeps X handles verbatim', () => {
    expect(toAuthorDisplay('X@servasyy_ai')).toBe('X@servasyy_ai')
    expect(toAuthorDisplay('x@waterloo_intern')).toBe('x@waterloo_intern')
  })

  it('strips Obsidian wikilinks and brackets from author display and slug', () => {
    expect(stripWikilinks('[[20VC]]')).toBe('20VC')
    expect(stripWikilinks('[[Harry Stebbings|Harry]]')).toBe('Harry')
    expect(stripWikilinks('[20VC]')).toBe('20VC')
    expect(stripWikilinks('[[ 20VC ]]')).toBe('20VC')

    expect(toAuthorDisplay('[[20VC]]')).toBe('20VC')
    expect(toAuthorDisplay('[[20vc]]')).toBe('20VC')
    expect(toAuthorDisplay('[[twiml-ai]]')).toBe('TWIML AI')
    expect(toAuthorDisplay('[[Harry Stebbings]]')).toBe('Harry Stebbings')
    expect(toAuthorDisplay('[[Harry Stebbings|Harry]]')).toBe('Harry')
    expect(toAuthorDisplay('[[X@servasyy_ai]]')).toBe('X@servasyy_ai')

    expect(toAuthorSlug('[[20VC]]')).toBe('20vc')
    expect(toAuthorSlug('[[Harry Stebbings|Harry]]')).toBe('harry')
  })
})
