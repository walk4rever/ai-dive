import { unified } from 'unified'
import rehypeParse from 'rehype-parse'
import { toText } from 'hast-util-to-text'
import { visit } from 'unist-util-visit'
import type { Element } from 'hast'

export interface ArticleHeading {
  id: string
  text: string
  level: 2 | 3 | 4
}

export function extractHeadings(html: string): ArticleHeading[] {
  const tree = unified().use(rehypeParse, { fragment: true }).parse(html)
  const headings: ArticleHeading[] = []

  visit(tree, 'element', (node: Element) => {
    if (node.tagName !== 'h2' && node.tagName !== 'h3' && node.tagName !== 'h4') return

    const id = node.properties?.id
    if (typeof id !== 'string' || !id) return

    const text = toText(node).trim()
    if (!text) return

    const level = node.tagName === 'h2' ? 2 : node.tagName === 'h3' ? 3 : 4
    headings.push({ id, text, level })
  })

  return headings
}
