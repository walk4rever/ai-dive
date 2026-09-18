/**
 * 构建高光分享文案
 * 格式：引用段落 + 文章标题引用 + 原文链接 + 品牌 slogan
 */
export interface HighlightShareParams {
  title: string
  slug: string
  quoteText: string
  author?: string | null
  siteOrigin?: string
}

export function buildHighlightShareText({
  title,
  slug,
  quoteText,
  author,
  siteOrigin,
}: HighlightShareParams): string {
  const origin = siteOrigin || process.env.NEXT_PUBLIC_SITE_URL || 'https://ai.air7.fun'
  const url = `${origin.replace(/\/+$/, '')}/post/${encodeURIComponent(slug)}`

  // 标题加书名号
  const trimmedTitle = title.trim()
  const safeTitle = (trimmedTitle.startsWith('《') && trimmedTitle.endsWith('》'))
    ? trimmedTitle
    : `《${trimmedTitle}》`

  // 作者信息（如果有且不是默认值）
  const hasDistinctAuthor = author?.trim() && author.trim() !== 'AI-DIVE' && author.trim() !== '编辑部'
  const authorCiting = hasDistinctAuthor ? ` · ${author.trim()}` : ''
  const citation = `—— 摘自${safeTitle}${authorCiting}`

  // 格式化引用文本（去除多余空行）
  const formattedQuote = quoteText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line, index, arr) => line.length > 0 || (index > 0 && arr[index - 1].length > 0))
    .join('\n')

  return [
    `"${formattedQuote}"`,
    '',
    citation,
    '',
    `🔗 原文链接：${url}`,
    '',
    '【AI-DIVE】深入 AI 技术核心，从论文到实战全面拆解。',
  ].join('\n')
}
