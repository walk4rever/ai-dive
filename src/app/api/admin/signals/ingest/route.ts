'use server'

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/admin-auth'
import { createServiceClient } from '@/lib/supabase/server'

const AIHOT_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const AIHOT_BASE = 'https://aihot.virxact.com'
const OG_TIMEOUT_MS = 3000
const OG_CONCURRENCY = 5

interface AihotItem {
  id: string
  title: string
  title_en: string | null
  url: string
  source: string
  publishedAt: string | null
  summary: string | null
  category: string | null
}

interface AihotDailyItem {
  title: string
  summary: string | null
  sourceUrl: string
  sourceName: string
}

interface AihotDailySection {
  label: string
  items: AihotDailyItem[]
}

function parseSource(source: string): { source_type: string; source_name: string } {
  if (source.startsWith('X：') || source.startsWith('X:')) {
    return { source_type: 'twitter', source_name: source.replace(/^X[：:]\s*/, '') }
  }
  if (source.includes('Hacker News') || source.includes('HN')) {
    return { source_type: 'hn', source_name: 'Hacker News' }
  }
  if (source.includes('GitHub')) {
    return { source_type: 'github', source_name: source }
  }
  if (source.includes('arXiv') || source.includes('arxiv')) {
    return { source_type: 'arxiv', source_name: 'arXiv' }
  }
  if (source.includes('Hugging Face')) {
    return { source_type: 'huggingface', source_name: source }
  }
  return { source_type: 'blog', source_name: source }
}

async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(OG_TIMEOUT_MS),
      headers: { 'User-Agent': AIHOT_UA },
    })
    const html = await res.text()
    const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
    const raw = match?.[1] ?? null
    if (!raw) return null
    if (raw.startsWith('http')) return raw
    const base = new URL(url)
    return new URL(raw, base.origin).href
  } catch {
    return null
  }
}

async function fetchOgImageBatch(urls: string[]): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>()
  for (let i = 0; i < urls.length; i += OG_CONCURRENCY) {
    const batch = urls.slice(i, i + OG_CONCURRENCY)
    const images = await Promise.all(batch.map((url) => fetchOgImage(url)))
    batch.forEach((url, idx) => result.set(url, images[idx]))
  }
  return result
}

async function fetchItemsApi(since: string): Promise<AihotItem[]> {
  const items: AihotItem[] = []
  let cursor: string | null = null

  while (true) {
    const params = new URLSearchParams({ mode: 'selected', since, take: '100' })
    if (cursor) params.set('cursor', cursor)

    const res = await fetch(`${AIHOT_BASE}/api/public/items?${params}`, {
      headers: { 'User-Agent': AIHOT_UA },
    })
    if (!res.ok) break

    const data = await res.json() as { items: AihotItem[]; hasNext: boolean; nextCursor: string | null }
    items.push(...data.items)
    if (!data.hasNext || !data.nextCursor) break
    cursor = data.nextCursor
  }

  return items
}

async function fetchDailyApi(date: string): Promise<AihotItem[]> {
  const res = await fetch(`${AIHOT_BASE}/api/public/daily/${date}`, {
    headers: { 'User-Agent': AIHOT_UA },
  })
  if (!res.ok) return []

  const data = await res.json() as { date: string; sections: AihotDailySection[] }
  const items: AihotItem[] = []

  const categoryMap: Record<string, string> = {
    '模型发布/更新': 'ai-models',
    '产品发布/更新': 'ai-products',
    '行业动态': 'industry',
    '论文研究': 'paper',
    '技巧与观点': 'tip',
  }

  for (const section of data.sections ?? []) {
    const category = categoryMap[section.label] ?? null
    for (const item of section.items ?? []) {
      items.push({
        id: '',
        title: item.title,
        title_en: null,
        url: item.sourceUrl,
        source: item.sourceName,
        publishedAt: `${date}T00:00:00.000Z`,
        summary: item.summary ?? null,
        category,
      })
    }
  }

  return items
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function POST(req: NextRequest) {
  const authed = await requireAdminSession(req)
  if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { from, to } = await req.json().catch(() => ({})) as { from?: string; to?: string }

  const now = new Date()
  const toDate = to ?? toIsoDate(now)
  const fromDate = from ?? toIsoDate(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000))

  // items API covers last 7 days; use daily API for older dates
  const sevenDaysAgo = toIsoDate(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000))
  const allItems: AihotItem[] = []

  // dates older than 7 days → daily API
  const oldDates: string[] = []
  const cursor = new Date(fromDate)
  const sevenDaysAgoDate = new Date(sevenDaysAgo)
  while (cursor < sevenDaysAgoDate) {
    oldDates.push(toIsoDate(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  for (const date of oldDates) {
    const items = await fetchDailyApi(date)
    allItems.push(...items)
  }

  // recent dates → items API
  const since = sevenDaysAgoDate < new Date(fromDate) ? `${fromDate}T00:00:00.000Z` : `${sevenDaysAgo}T00:00:00.000Z`
  const recentItems = await fetchItemsApi(since)
  // filter to requested date range
  allItems.push(...recentItems.filter((item) => {
    const d = item.publishedAt?.slice(0, 10) ?? ''
    return d >= fromDate && d <= toDate
  }))

  // deduplicate by url
  const seen = new Set<string>()
  const unique = allItems.filter((item) => {
    if (!item.url || seen.has(item.url)) return false
    seen.add(item.url)
    return true
  })

  // fetch OG images
  const ogMap = await fetchOgImageBatch(unique.map((i) => i.url))

  // build rows
  const rows = unique.map((item) => {
    const { source_type, source_name } = parseSource(item.source ?? '')
    const date = item.publishedAt?.slice(0, 10) ?? toDate
    return {
      url: item.url,
      source_type,
      source_name,
      title: item.title ?? '',
      description: item.summary ?? '',
      date,
      status: 'selected' as const,
      metadata: {
        og_image: ogMap.get(item.url) ?? null,
        category: item.category ?? null,
        aihot_id: item.id || null,
        title_en: item.title_en ?? null,
      },
    }
  })

  const supabase = await createServiceClient()
  const { error, count } = await supabase
    .from('ai_pulse_signals')
    .upsert(rows, { onConflict: 'url', ignoreDuplicates: true })
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, inserted: count ?? rows.length, total: rows.length })
}
