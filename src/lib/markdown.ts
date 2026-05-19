import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypePrettyCode from 'rehype-pretty-code'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeStringify from 'rehype-stringify'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'

interface MarkdownNode {
  type?: string
  tagName?: string
  value?: string
  properties?: {
    className?: string[]
    [key: string]: string | string[] | number | boolean | undefined
  }
  children?: MarkdownNode[]
}

function extractText(node: MarkdownNode | undefined): string {
  if (!node) return ''
  if (node.type === 'text') return typeof node.value === 'string' ? node.value : ''
  if (!Array.isArray(node.children)) return ''
  return node.children.map(extractText).join('')
}

function rehypeMermaidBlocks() {
  return (tree: MarkdownNode) => {
    const visit = (node: MarkdownNode) => {
      if (!node || !Array.isArray(node.children)) return

      node.children = node.children.map((child) => {
        if (child?.type !== 'element' || child.tagName !== 'pre') {
          visit(child)
          return child
        }

        const code = child.children?.[0]
        const classNames = Array.isArray(code?.properties?.className)
          ? code.properties.className
          : []

        if (code?.type !== 'element' || code.tagName !== 'code' || !classNames.includes('language-mermaid')) {
          visit(child)
          return child
        }

        return {
          type: 'element',
          tagName: 'div',
          properties: {
            className: ['mermaid'],
            'data-mermaid': 'true',
          },
          children: [
            {
              type: 'text',
              value: extractText(code).trim(),
            },
          ],
        }
      })
    }

    visit(tree)
  }
}

/**
 * Custom schema for rehype-sanitize to allow rich media while staying secure.
 */
const schema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames || []),
    'audio',
    'video',
    'source',
    'iframe',
  ],
  attributes: {
    ...defaultSchema.attributes,
    audio: ['src', 'controls', 'style'],
    video: ['src', 'controls', 'style', 'width', 'height', 'poster'],
    source: ['src', 'type'],
    iframe: [
      'src',
      'width',
      'height',
      'frameborder',
      'allow',
      'allowfullscreen',
      'style',
      'title',
    ],
    // Allow mermaid data attributes
    div: [...(defaultSchema.attributes?.div || []), 'className', 'data-mermaid', 'data-mermaid-processed'],
  },
}

export async function markdownToHtml(markdown: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeMermaidBlocks)
    .use(rehypeSanitize, schema) // Sanitize AFTER mermaid blocks are converted
    .use(rehypePrettyCode, {
      theme: 'github-light',
      keepBackground: false,
    })
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, { behavior: 'wrap' })
    .use(rehypeStringify) // allowDangerousHtml is no longer needed here as we sanitize before
    .process(markdown)

  return String(file)
}
