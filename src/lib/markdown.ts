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

function rehypeCallouts() {
  return (tree: MarkdownNode) => {
    const visit = (node: MarkdownNode) => {
      if (!node || !Array.isArray(node.children)) return

      node.children = node.children.map((child) => {
        if (child?.type !== 'element' || child.tagName !== 'blockquote') {
          visit(child)
          return child
        }

        const blockChildren = child.children
        if (!blockChildren) { visit(child); return child }

        const firstParaIdx = blockChildren.findIndex(
          (c) => c?.type === 'element' && c.tagName === 'p'
        )
        if (firstParaIdx === -1) { visit(child); return child }

        const firstPara = blockChildren[firstParaIdx]
        const firstText = firstPara.children?.[0]
        if (!firstText || firstText.type !== 'text' || typeof firstText.value !== 'string') {
          visit(child)
          return child
        }

        const lines = firstText.value.split('\n')
        const match = lines[0].match(/^\[!([A-Za-z]+)\]\s*(.*)$/)
        if (!match) { visit(child); return child }

        const [, type, titleText] = match
        const typeKey = type.toLowerCase()
        const remainingText = lines.slice(1).join('\n').trim()

        const contentChildren: MarkdownNode[] = []
        if (remainingText || (firstPara.children?.length ?? 0) > 1) {
          contentChildren.push({
            type: 'element',
            tagName: 'p',
            properties: {},
            children: [
              ...(remainingText ? [{ type: 'text', value: remainingText }] : []),
              ...(firstPara.children?.slice(1) ?? []),
            ],
          })
        }
        contentChildren.push(...blockChildren.slice(firstParaIdx + 1))

        return {
          type: 'element',
          tagName: 'div',
          properties: { className: ['callout', `callout-${typeKey}`] },
          children: [
            {
              type: 'element',
              tagName: 'div',
              properties: { className: ['callout-title'] },
              children: titleText ? [{ type: 'text', value: titleText }] : [],
            },
            {
              type: 'element',
              tagName: 'div',
              properties: { className: ['callout-content'] },
              children: contentChildren,
            },
          ],
        }
      })
    }

    visit(tree)
  }
}

function extractYouTubeVideoId(href: string): string | null {
  try {
    const url = new URL(href)
    const host = url.hostname.replace(/^www\./, '')

    if (host === 'youtu.be') {
      const id = url.pathname.replace(/^\//, '').split('/')[0]
      return id ? id : null
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') {
        const id = url.searchParams.get('v')
        return id ? id : null
      }
      const match = url.pathname.match(/^\/embed\/([^/?#]+)/)
      if (match?.[1]) return match[1]
    }
  } catch {
    return null
  }

  return null
}

function rehypeYouTubeEmbeds() {
  return (tree: MarkdownNode) => {
    const visit = (node: MarkdownNode) => {
      if (!node || !Array.isArray(node.children)) return

      node.children = node.children.map((child) => {
        if (child?.type !== 'element') {
          visit(child)
          return child
        }

        if ((child.tagName === 'p' || child.tagName === 'li') && Array.isArray(child.children)) {
          if (child.children.length === 1 && child.children[0]?.type === 'text') {
            const text = extractText(child).trim()
            const id = extractYouTubeVideoId(text)
            if (id) {
              return {
                type: 'element',
                tagName: 'iframe',
                properties: {
                  src: `https://www.youtube.com/embed/${id}`,
                  title: 'YouTube',
                  width: '100%',
                  height: '315',
                  frameborder: '0',
                  allow:
                    'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
                  allowfullscreen: true,
                  style: 'width:100%;aspect-ratio:16/9;',
                },
                children: [],
              }
            }
          }

          const anchors = child.children.filter((n) => n?.type === 'element' && n.tagName === 'a')
          if (anchors.length === 1) {
            const href = String(anchors[0].properties?.href ?? '')
            const id = extractYouTubeVideoId(href)
            if (id) {
              const text = extractText(child).trim().replace(/\s+/g, ' ')
              const linkText = extractText(anchors[0]).trim()
              if (
                text === href ||
                text === linkText ||
                text === `原视频：${href}` ||
                text === `原视频: ${href}` ||
                (text.endsWith(href) && text.length <= href.length + 6)
              ) {
                return {
                  type: 'element',
                  tagName: 'iframe',
                  properties: {
                    src: `https://www.youtube.com/embed/${id}`,
                    title: 'YouTube',
                    width: '100%',
                    height: '315',
                    frameborder: '0',
                    allow:
                      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
                    allowfullscreen: true,
                    style: 'width:100%;aspect-ratio:16/9;',
                  },
                  children: [],
                }
              }
            }
          }
        }

        visit(child)
        return child
      })
    }

    visit(tree)
  }
}

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
    div: [...(defaultSchema.attributes?.div || []), 'className', 'data-mermaid', 'data-mermaid-processed'],
  },
}

export async function markdownToHtml(markdown: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeMermaidBlocks)
    .use(rehypeCallouts)
    .use(rehypeYouTubeEmbeds)
    .use(rehypeSanitize, schema)
    .use(rehypePrettyCode, {
      theme: 'github-light',
      keepBackground: false,
    })
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, { behavior: 'wrap' })
    .use(rehypeStringify)
    .process(markdown)

  return String(file)
}
