import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkDirective from 'remark-directive'
import remarkRehype from 'remark-rehype'
import rehypeRaw from 'rehype-raw'
import rehypeKatex from 'rehype-katex'
import rehypePrettyCode from 'rehype-pretty-code'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeStringify from 'rehype-stringify'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { visit } from 'unist-util-visit'

function extractText(node) {
  if (!node) return ''
  if (node.type === 'text') return typeof node.value === 'string' ? node.value : ''
  if (!Array.isArray(node.children)) return ''
  return node.children.map(extractText).join('')
}

export function rehypeMermaidBlocks() {
  return (tree) => {
    const visit = (node) => {
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

export function rehypeCallouts() {
  return (tree) => {
    const visit = (node) => {
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

        const contentChildren = []
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
              children: [
                {
                  type: 'element',
                  tagName: 'span',
                  properties: { className: ['callout-label'] },
                  children: [{ type: 'text', value: type }],
                },
                ...(titleText ? [{ type: 'text', value: ` ${titleText}` }] : []),
              ],
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

function extractYouTubeVideoId(href) {
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

export function rehypeYouTubeEmbeds() {
  return (tree) => {
    const visit = (node) => {
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

const EMBED_HEIGHT_DEFAULT = 800
const EMBED_HEIGHT_MIN = 100
const EMBED_HEIGHT_MAX = 40000

function allowedEmbedHosts() {
  const hosts = new Set()
  if (process.env.CLOUDFLARE_R2_PUBLIC_URL) {
    try {
      hosts.add(new URL(process.env.CLOUDFLARE_R2_PUBLIC_URL).host)
    } catch {
      // Malformed env value — treat as no allowed hosts (fail closed).
    }
  }
  return hosts
}

function isAllowedEmbedSrc(src) {
  try {
    const url = new URL(src)
    return url.protocol === 'https:' && allowedEmbedHosts().has(url.host)
  } catch {
    return false
  }
}

function rejectEmbedDirective(node, message) {
  node.type = 'paragraph'
  node.children = [{ type: 'text', value: message }]
  node.data = { hName: 'p', hProperties: {} }
  delete node.name
  delete node.attributes
}

// Turns `::embed{src="https://<r2-host>/..." height="2400"}` into a sandboxed iframe.
// `sandbox` is always `allow-scripts` (never `allow-same-origin`) so embedded content
// can't reach the parent page's cookies or DOM, and `src` must resolve to the
// configured R2 public host — authors can't point this at an arbitrary third-party URL.
export function remarkEmbedDirective() {
  return (tree) => {
    visit(tree, (node) => node.type === 'leafDirective' && node.name === 'embed', (node) => {
      const src = typeof node.attributes?.src === 'string' ? node.attributes.src.trim() : ''

      if (!isAllowedEmbedSrc(src)) {
        rejectEmbedDirective(node, `Embed blocked: src must be an https URL on the configured R2 host (got "${src || 'empty'}").`)
        return
      }

      const parsedHeight = Number.parseInt(node.attributes?.height, 10)
      const height = Number.isFinite(parsedHeight)
        ? Math.min(Math.max(parsedHeight, EMBED_HEIGHT_MIN), EMBED_HEIGHT_MAX)
        : EMBED_HEIGHT_DEFAULT

      node.data = {
        hName: 'iframe',
        hProperties: {
          src,
          sandbox: 'allow-scripts',
          loading: 'lazy',
          title: 'Embedded interactive content',
          style: `width:100%;height:${height}px;border:0;`,
          // Lets the client find our embeds and auto-resize them from the
          // postMessage the embedded page's own resize-reporter script sends
          // (injected at upload time — see scripts/upload-html-embed.mjs).
          // `height` above is just the pre-JS initial guess.
          'data-ai-dive-embed': 'true',
        },
      }
      node.children = []
    })
  }
}

export const sanitizeSchema = {
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
      'sandbox',
      'loading',
      'data-ai-dive-embed',
    ],
    div: [...(defaultSchema.attributes?.div || []), 'className', 'data-mermaid', 'data-mermaid-processed'],
    span: [...(defaultSchema.attributes?.span || []), 'className'],
  },
}

// `sanitize: false` is for trusted, locally-authored content (Vault CLI import) where the
// author controls every byte of markdown. `sanitize: true` is for content submitted over
// the network (agent API) and must not trust raw HTML at face value.
export async function markdownToHtml(markdown, { sanitize } = { sanitize: true }) {
  let processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkDirective)
    .use(remarkEmbedDirective)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeMermaidBlocks)
    .use(rehypeCallouts)
    .use(rehypeYouTubeEmbeds)

  if (sanitize) {
    processor = processor.use(rehypeSanitize, sanitizeSchema)
  }

  processor = processor
    .use(rehypeKatex)
    .use(rehypePrettyCode, {
      theme: 'github-light',
      keepBackground: false,
    })
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, { behavior: 'wrap' })
    .use(rehypeStringify)

  const file = await processor.process(markdown)
  return String(file)
}
