import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'

const WIKI_DIR = path.resolve(process.cwd(), 'wiki-content')

export const WIKI_CATEGORIES = ['entities', 'concepts', 'comparisons', 'queries'] as const
export type WikiCategory = (typeof WIKI_CATEGORIES)[number]

export const CATEGORY_LABELS: Record<WikiCategory, string> = {
  entities: '主体',
  concepts: '概念',
  comparisons: '对比',
  queries: '研究',
}

export interface WikiFrontmatter {
  title: string
  created?: string | Date
  updated?: string | Date
  type?: string
  tags?: string[]
  sources?: string[]
}

export function formatWikiDate(val: string | Date | undefined): string {
  if (!val) return ''
  if (val instanceof Date) return val.toISOString().slice(0, 10)
  return String(val)
}

export interface WikiPage {
  slug: string
  category: WikiCategory
  frontmatter: WikiFrontmatter
  excerpt: string
}

export interface WikiPageWithContent extends WikiPage {
  html: string
  toc: TocItem[]
  backlinks: WikiPage[]
}

export interface TocItem {
  id: string
  text: string
  level: number
}

function parseFrontmatter(raw: string): { frontmatter: WikiFrontmatter; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) return { frontmatter: { title: 'Untitled' }, body: raw }
  const data = yaml.load(match[1]) as WikiFrontmatter
  return { frontmatter: data, body: match[2] }
}

function extractExcerpt(markdown: string): string {
  const lines = markdown
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('|') && !l.startsWith('-'))
  const text = lines.slice(0, 3).join(' ').replace(/\*\*|__|\*|_|`/g, '')
  return text.length > 140 ? text.slice(0, 140) + '…' : text
}

function extractToc(html: string): TocItem[] {
  const toc: TocItem[] = []
  const regex = /<h([2-4])[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/h[2-4]>/g
  let match
  while ((match = regex.exec(html)) !== null) {
    const text = match[3].replace(/<[^>]+>/g, '').trim()
    toc.push({ level: parseInt(match[1]), id: match[2], text })
  }
  return toc
}

function extractInternalLinks(body: string): string[] {
  const slugs: string[] = []
  const wikiLinkRe = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g
  let m
  while ((m = wikiLinkRe.exec(body)) !== null) {
    slugs.push(m[1].trim())
  }
  return slugs
}

async function readPageFile(
  category: WikiCategory,
  file: string,
): Promise<WikiPage | null> {
  if (!file.endsWith('.md')) return null
  const slug = file.replace(/\.md$/, '')
  const filePath = path.join(WIKI_DIR, category, file)
  const raw = await readFile(filePath, 'utf8')
  const { frontmatter, body } = parseFrontmatter(raw)
  return { slug, category, frontmatter, excerpt: extractExcerpt(body) }
}

export async function getWikiPages(category?: WikiCategory): Promise<WikiPage[]> {
  const categories = category ? [category] : [...WIKI_CATEGORIES]
  const pages: WikiPage[] = []

  for (const cat of categories) {
    const dir = path.join(WIKI_DIR, cat)
    if (!existsSync(dir)) continue
    const files = await readdir(dir)
    const results = await Promise.all(files.map((f) => readPageFile(cat, f)))
    pages.push(...(results.filter(Boolean) as WikiPage[]))
  }

  return pages.sort((a, b) => {
    const da = String(a.frontmatter.updated ?? a.frontmatter.created ?? '')
    const db = String(b.frontmatter.updated ?? b.frontmatter.created ?? '')
    return db.localeCompare(da)
  })
}

export async function getWikiPage(
  category: WikiCategory,
  slug: string,
): Promise<WikiPageWithContent | null> {
  const filePath = path.join(WIKI_DIR, category, `${slug}.md`)
  if (!existsSync(filePath)) return null

  const raw = await readFile(filePath, 'utf8')
  const { frontmatter, body } = parseFrontmatter(raw)

  // resolve [[wikilinks]] to proper hrefs before rendering
  const resolvedBody = await resolveWikiLinks(body)

  const { markdownToHtml } = await import('./markdown')
  const html = await markdownToHtml(resolvedBody)
  const toc = extractToc(html)

  const linkedSlugs = extractInternalLinks(body)
  const backlinks = await findBacklinks(slug)
  void linkedSlugs

  return {
    slug,
    category,
    frontmatter,
    excerpt: extractExcerpt(body),
    html,
    toc,
    backlinks,
  }
}

async function resolveWikiLinks(markdown: string): Promise<string> {
  const allPages = await getWikiPages()
  return markdown.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, slug, label) => {
    const normalized = slug.trim().toLowerCase().replace(/\s+/g, '-')
    const page = allPages.find(
      (p) =>
        p.slug === normalized ||
        p.slug === slug.trim() ||
        p.frontmatter.title?.toLowerCase() === slug.trim().toLowerCase(),
    )
    const text = label?.trim() ?? slug.trim()
    if (page) return `[${text}](/wiki/${page.category}/${page.slug})`
    return `[${text}](#)`
  })
}

async function findBacklinks(targetSlug: string): Promise<WikiPage[]> {
  const allPages = await getWikiPages()
  const backlinks: WikiPage[] = []

  for (const page of allPages) {
    if (page.slug === targetSlug) continue
    const filePath = path.join(WIKI_DIR, page.category, `${page.slug}.md`)
    const raw = await readFile(filePath, 'utf8')
    if (raw.includes(`[[${targetSlug}`) || raw.includes(`[[${page.frontmatter.title}`)) {
      backlinks.push(page)
    }
  }

  return backlinks
}

export interface GraphNode {
  id: string
  slug: string
  category: WikiCategory
  title: string
  val: number
}

export interface GraphLink {
  source: string
  target: string
}

export interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

export async function getWikiGraphData(): Promise<GraphData> {
  const allPages = await getWikiPages()
  const slugToId = new Map(allPages.map((p) => [p.slug, `${p.category}/${p.slug}`]))

  const nodes: GraphNode[] = allPages.map((p) => ({
    id: `${p.category}/${p.slug}`,
    slug: p.slug,
    category: p.category,
    title: p.frontmatter.title,
    val: 1,
  }))

  const links: GraphLink[] = []
  const seen = new Set<string>()

  for (const page of allPages) {
    const filePath = path.join(WIKI_DIR, page.category, `${page.slug}.md`)
    const raw = await readFile(filePath, 'utf8')
    const wikiLinks = extractInternalLinks(raw)
    const sourceId = `${page.category}/${page.slug}`

    for (const linkedSlug of wikiLinks) {
      const targetId = slugToId.get(linkedSlug)
      if (!targetId || targetId === sourceId) continue
      const key = `${sourceId}→${targetId}`
      if (seen.has(key)) continue
      seen.add(key)
      links.push({ source: sourceId, target: targetId })
    }
  }

  // boost node size by link count
  const linkCount = new Map<string, number>()
  for (const link of links) {
    linkCount.set(link.source, (linkCount.get(link.source) ?? 0) + 1)
    linkCount.set(link.target, (linkCount.get(link.target) ?? 0) + 1)
  }

  return {
    nodes: nodes.map((n) => ({ ...n, val: 1 + (linkCount.get(n.id) ?? 0) })),
    links,
  }
}
