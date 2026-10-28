/**
 * Utilities for cleaning autolink URLs parsed from Markdown in agent responses.
 * remark-gfm autolink literal swallows trailing CJK punctuation (e.g. ）。，！？)
 * into href, which breaks the link when clicked.
 */

const TRAILING_PUNCT_REGEX = /[））。，；！？“”’》】]+$/

export interface CleanedLink {
  href: string
  trailingText: string
  cleanChildren?: unknown
  isExternal: boolean
}

export function cleanMarkdownLink(href?: string, children?: unknown): CleanedLink {
  let cleanHref = href ?? ''
  let trailingText = ''

  const match = cleanHref.match(TRAILING_PUNCT_REGEX)
  if (match) {
    trailingText = match[0]
    cleanHref = cleanHref.slice(0, -trailingText.length)
  }

  // Normalize legacy ai.air7.fun to canonical ai.air7fun.com
  cleanHref = cleanHref.replace(/^https?:\/\/ai\.air7\.fun\b/, 'https://ai.air7fun.com')

  let cleanChildren = children
  if (typeof children === 'string' && trailingText && children.endsWith(trailingText)) {
    cleanChildren = children.slice(0, -trailingText.length)
  }

  const isExternal = /^https?:\/\//i.test(cleanHref)

  return {
    href: cleanHref,
    trailingText,
    cleanChildren,
    isExternal,
  }
}
