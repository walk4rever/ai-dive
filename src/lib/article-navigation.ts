export interface ArticleNavigationItem {
  id: string
  slug: string
  title: string
  topic_order?: number | null
  published_at?: string | null
  created_at?: string | null
}

export interface ArticleNavigationLink {
  slug: string
  title: string
}

export interface ArticleNavigationData {
  kind: 'topic' | 'column'
  heading: string
  position: string | null
  previous: ArticleNavigationLink | null
  next: ArticleNavigationLink | null
  allHref: string
  allLabel: string
  previousLabel: string
  nextLabel: string
}

function toLink(item: ArticleNavigationItem): ArticleNavigationLink {
  return { slug: item.slug, title: item.title }
}

function timestamp(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

export function buildTopicNavigation(
  items: ArticleNavigationItem[],
  currentId: string,
  topic: { id: string; name: string }
): ArticleNavigationData | null {
  const ordered = items
    .filter((item) => typeof item.topic_order === 'number')
    .sort((a, b) => {
      const byOrder = (a.topic_order ?? 0) - (b.topic_order ?? 0)
      return byOrder || a.id.localeCompare(b.id)
    })
  const index = ordered.findIndex((item) => item.id === currentId)

  if (index === -1 || ordered.length < 2) return null

  return {
    kind: 'topic',
    heading: `专题 · ${topic.name}`,
    position: `${index + 1} / ${ordered.length}`,
    previous: index > 0 ? toLink(ordered[index - 1]) : null,
    next: index < ordered.length - 1 ? toLink(ordered[index + 1]) : null,
    allHref: `/series#${topic.id}`,
    allLabel: '查看全部专题',
    previousLabel: '上一篇',
    nextLabel: '下一篇',
  }
}

export function buildColumnNavigation(
  items: ArticleNavigationItem[],
  currentId: string,
  contentType: 'dive',
  label: string
): ArticleNavigationData | null {
  const ordered = [...items].sort((a, b) => {
    const byPublished = timestamp(b.published_at) - timestamp(a.published_at)
    if (byPublished !== 0) return byPublished

    const byCreated = timestamp(b.created_at) - timestamp(a.created_at)
    if (byCreated !== 0) return byCreated

    return b.id.localeCompare(a.id)
  })
  const index = ordered.findIndex((item) => item.id === currentId)

  if (index === -1 || ordered.length < 2) return null

  return {
    kind: 'column',
    heading: `继续阅读 · ${label}`,
    position: null,
    // Newest-first list:
    // Left (previous): newer article (index - 1)
    // Right (next): older article (index + 1)
    previous: index > 0 ? toLink(ordered[index - 1]) : null,
    next: index < ordered.length - 1 ? toLink(ordered[index + 1]) : null,
    allHref: '/dives',
    allLabel: `查看全部${label}`,
    previousLabel: '更新一篇',
    nextLabel: '更早一篇',
  }
}
