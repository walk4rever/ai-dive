/**
 * 构建高光分享文案
 * 格式：「引用段落」 + —— 《标题》（链接） + 品牌 slogan
 * 同时产出纯文本（微信/微博等）与 HTML（飞书/Notion/邮件等富文本，标题即链接）两种版本。
 */
export interface HighlightShareParams {
  title: string
  slug?: string
  url?: string
  quoteText: string
  author?: string | null
  siteOrigin?: string
}

export interface HighlightShareContent {
  text: string
  html: string
}

export const HIGHLIGHT_SHARE_SLOGAN = '【AI-DIVE】学习 AI，从知道，到做到。'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function resolveParts({ title, slug, url, quoteText, author, siteOrigin }: HighlightShareParams) {
  const origin = siteOrigin || process.env.NEXT_PUBLIC_SITE_URL || 'https://ai.air7.fun'
  const normalizedOrigin = origin.replace(/\/+$/, '')
  const shareLink = url
    ? url.startsWith('http')
      ? url
      : `${normalizedOrigin}${url.startsWith('/') ? '' : '/'}${url}`
    : `${normalizedOrigin}/post/${encodeURIComponent(slug ?? '')}`

  // 标题加书名号
  const trimmedTitle = title.trim()
  const safeTitle = (trimmedTitle.startsWith('《') && trimmedTitle.endsWith('》'))
    ? trimmedTitle
    : `《${trimmedTitle}》`

  // 作者信息（如果有且不是默认值）
  const hasDistinctAuthor = author?.trim() && author.trim() !== 'AI-DIVE' && author.trim() !== '编辑部'
  const authorCiting = hasDistinctAuthor ? ` · ${author!.trim()}` : ''

  // 格式化引用文本（去除多余空行）
  const formattedQuote = quoteText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line, index, arr) => line.length > 0 || (index > 0 && arr[index - 1].length > 0))
    .join('\n')
    .trim()

  return { shareLink, safeTitle, authorCiting, formattedQuote }
}

export function buildHighlightShareText(params: HighlightShareParams): string {
  const { shareLink, safeTitle, authorCiting, formattedQuote } = resolveParts(params)
  return [
    `「${formattedQuote}」`,
    '',
    `—— ${safeTitle}${authorCiting} ${shareLink}`,
    '',
    HIGHLIGHT_SHARE_SLOGAN,
  ].join('\n')
}

export function buildHighlightShareHtml(params: HighlightShareParams): string {
  const { shareLink, safeTitle, authorCiting, formattedQuote } = resolveParts(params)
  const quoteHtml = escapeHtml(`「${formattedQuote}」`).replace(/\n/g, '<br>')
  return [
    `<p>${quoteHtml}</p>`,
    `<p>—— <a href="${escapeHtml(shareLink)}">${escapeHtml(safeTitle)}</a>${escapeHtml(authorCiting)}</p>`,
    `<p>${escapeHtml(HIGHLIGHT_SHARE_SLOGAN)}</p>`,
  ].join('')
}

export function buildHighlightShareContent(params: HighlightShareParams): HighlightShareContent {
  return {
    text: buildHighlightShareText(params),
    html: buildHighlightShareHtml(params),
  }
}
