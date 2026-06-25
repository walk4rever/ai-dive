import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypePrettyCode from 'rehype-pretty-code'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeStringify from 'rehype-stringify'

function rehypeCallouts() {
  return (tree) => {
    const visit = (node) => {
      if (!node || !Array.isArray(node.children)) return

      node.children = node.children.map((child) => {
        if (child?.type !== 'element' || child.tagName !== 'blockquote') {
          visit(child)
          return child
        }

        const firstParaIdx = child.children?.findIndex(
          (c) => c?.type === 'element' && c.tagName === 'p'
        ) ?? -1
        if (firstParaIdx === -1) { visit(child); return child }

        const firstPara = child.children[firstParaIdx]
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
        contentChildren.push(...(child.children?.slice(firstParaIdx + 1) ?? []))

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

export async function markdownToHtml(markdown) {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeCallouts)
    .use(rehypePrettyCode, {
      theme: 'github-light',
      keepBackground: false,
    })
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, { behavior: 'wrap' })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(markdown)

  return String(file)
}
