import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getSupabaseEnv } from '@/lib/supabase/env'
import { Post, Signal } from '@/types'
import { getTypeLabel, getSourceLabel } from '@/lib/content'
import { toAuthorDisplay } from '@/lib/author'
import Link from 'next/link'
import { IntelCalendar } from '@/app/(site)/intels/IntelCalendar'
import { LatestIntelCards } from '@/app/(site)/intels/LatestIntelCards'
import { getTodayYmd } from '@/lib/timezone'
import { getMonthDateRange } from '@/lib/signals-calendar'
import { fetchCachedSignalCalendarDays } from '@/lib/signals-calendar-server'
import { intelDatePath } from '@/lib/intel-links'

export const revalidate = 60

interface HomePageProps {
  searchParams: Promise<{ confirmed?: string; im?: string; m?: string }>
}

type HomePost = Pick<
  Post,
  'id' | 'slug' | 'title' | 'excerpt' | 'is_premium' | 'published_at' | 'content_type' | 'featured' | 'author_slug' | 'author_display'
>

interface SeriesItem {
  id: string
  name: string
  description: string
  postCount: number
}

function formatDate(value: string | null | undefined) {
  if (!value) return ''
  const d = new Date(value)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function parseYearMonth(value?: string): { year: number; month: number } | null {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})$/.exec(value)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null
  return { year, month }
}

function parseYearMonthFromYmd(value: string): { year: number; month: number } {
  return { year: Number(value.slice(0, 4)), month: Number(value.slice(5, 7)) }
}


function FeaturedCard({ post }: { post: HomePost }) {
  return (
    <article className="bg-[var(--background)] rounded-2xl p-6 flex flex-col gap-4 shadow-[0_0_0_1px_var(--border-subtle),0_4px_24px_rgba(20,20,19,0.04)] transition-shadow hover:shadow-[0_0_0_1px_var(--ring),0_8px_32px_rgba(20,20,19,0.08)]">
      <div className="flex items-center justify-between">
        <span className="kicker" style={{ color: 'var(--accent)' }}>{getTypeLabel(post.content_type)}</span>
        <span className="date">{formatDate(post.published_at)}</span>
      </div>
      <Link href={postHref(post)} className="group flex-1">
        <h3 className="font-serif text-xl font-semibold leading-snug group-hover:text-[var(--accent)] transition-colors">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="mt-3 text-sm text-[var(--muted)] leading-relaxed line-clamp-3">
            {post.excerpt}
          </p>
        )}
      </Link>
    </article>
  )
}

function postHref(post: HomePost): string {
  if (post.content_type === 'intel') {
    const date = post.slug.replace('intel-', '')
    return intelDatePath(date)
  }
  return `/post/${post.slug}`
}

function postSourceLabel(post: HomePost): string {
  return toAuthorDisplay(post.author_display) ?? getSourceLabel(post.author_slug) ?? getTypeLabel(post.content_type)
}

function PostItem({ post }: { post: HomePost }) {
  const date = formatDate(post.published_at)

  return (
    <article className="py-6">
      <div className="flex items-start gap-6">
        {date && <span className="date hidden sm:block shrink-0 w-24 pt-1">{date}</span>}
        <div className="flex-1 min-w-0">
          <Link href={postHref(post)} className="group">
            <h3 className="font-serif text-lg md:text-xl font-semibold leading-snug group-hover:text-[var(--accent)] transition-colors">
              {post.title}
            </h3>
          </Link>
          {post.excerpt && (
            <p className="mt-2 text-sm text-[var(--muted)] leading-relaxed line-clamp-2">
              {post.excerpt}
            </p>
          )}
          {date && <span className="date mt-2 block sm:hidden">{date}</span>}
        </div>
        <span className="kicker shrink-0 pt-1.5" style={{ color: 'var(--accent)' }}>{postSourceLabel(post)}</span>
      </div>
    </article>
  )
}

function buildSections(posts: HomePost[]): { featured: HomePost[]; recent: HomePost[] } {
  const featured = posts.filter((p) => p.featured).slice(0, 3)
  const recent = posts.slice(0, 10)
  return { featured, recent }
}

function SeriesCard({ item }: { item: SeriesItem }) {
  return (
    <Link
      href={`/series#${item.id}`}
      className="group flex flex-col gap-2 bg-[var(--background)] hover:bg-white transition-colors rounded-2xl p-5 border border-[var(--border-subtle)] hover:border-[var(--ring)]"
    >
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-serif text-lg font-semibold text-[var(--foreground)] leading-snug group-hover:text-[var(--accent)] transition-colors">
          {item.name}
        </h3>
        <span className="shrink-0 text-xs text-[var(--muted)] mt-1">{item.postCount} 篇</span>
      </div>
      {item.description && (
        <p className="text-sm text-[var(--muted)] leading-relaxed line-clamp-2">{item.description}</p>
      )}
    </Link>
  )
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { confirmed, im, m } = await searchParams
  const { hasPublicEnv } = getSupabaseEnv()

  if (!hasPublicEnv) {
    return (
      <div className="space-y-4">
        <p className="kicker">配置未完成</p>
        <p className="text-[var(--muted)] text-sm">请在 .env.local 配置 Supabase 环境变量。</p>
      </div>
    )
  }

  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  const today = getTodayYmd()
  const todayYearMonth = parseYearMonthFromYmd(today)
  const selectedMonth = parseYearMonth(im) ?? parseYearMonth(m) ?? todayYearMonth
  const year = selectedMonth.year
  const month = selectedMonth.month
  const { monthStart, monthEnd } = getMonthDateRange(year, month)

  const [{ data: posts }, { data: topicsData }, { data: storiesWithTopics }, { data: signalData }, intelDays] = await Promise.all([
    supabase
      .from('ai_pulse_stories')
      .select('id, slug, title, excerpt, is_premium, published_at, content_type, featured, author_slug, author_display')
      .eq('status', 'published')
      .order('published_at', { ascending: false }).order('created_at', { ascending: false })
      .limit(100),
    serviceSupabase
      .from('ai_pulse_topics')
      .select('id, name, description')
      .order('created_at', { ascending: false }),
    serviceSupabase
      .from('ai_pulse_stories')
      .select('topic_id')
      .eq('status', 'published')
      .not('topic_id', 'is', null),
    supabase
      .from('ai_pulse_signals')
      .select('id, url, source_type, source_name, title, description, signal_date, status, metadata, created_at, updated_at')
      .eq('status', 'enabled')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(3),
    fetchCachedSignalCalendarDays(monthStart, monthEnd),
  ])

  const allPosts = (posts ?? []) as HomePost[]
  const { featured, recent } = buildSections(allPosts)
  const signals = (signalData ?? []) as Signal[]

  const countMap = new Map<string, number>()
  for (const row of (storiesWithTopics ?? [])) {
    if (!row.topic_id) continue
    countMap.set(row.topic_id, (countMap.get(row.topic_id) ?? 0) + 1)
  }
  const seriesList: SeriesItem[] = (topicsData ?? []).map((s) => ({
    ...s,
    postCount: countMap.get(s.id) ?? 0,
  }))

  return (
    <div>
      {confirmed === 'true' && (
        <p className="mb-12 text-sm text-[var(--muted)]">订阅已确认，感谢。</p>
      )}

      {/* Hero */}
      <section className="mb-20 md:mb-28">
        <h1 className="font-serif text-[2rem] md:text-[2.75rem] xl:text-[3.5rem] font-bold leading-[1.15] tracking-tight text-[var(--foreground)]">
          学习 AI，<br />从知道，到做到。
        </h1>
        <p className="mt-6 text-lg md:text-xl text-[var(--muted)] leading-relaxed">
          围绕 AI 的脉动，精选真正值得跟进的变化与判断 —— 情报、深度、访谈、专题。
        </p>
        <div className="mt-10 flex flex-col lg:flex-row lg:items-start gap-6">
          <div className="w-full lg:w-[280px] lg:shrink-0 rounded-2xl border border-[var(--border-subtle)] bg-white p-3">
            <IntelCalendar
              key={`${year}-${month}`}
              year={year}
              month={month}
              days={intelDays}
              monthParam="im"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <p className="kicker" style={{ color: 'var(--accent)' }}>最新情报</p>
              <Link
                href="/intels"
                className="kicker text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
              >
                全部情报 →
              </Link>
            </div>
            <LatestIntelCards signals={signals} />
          </div>
        </div>
      </section>

      {/* Series overview */}
      {seriesList.length > 0 && (
        <section className="mb-20 -mx-6 bg-[var(--surface-sand)] px-8 md:px-12 py-10 md:py-12 rounded-3xl">
          <div className="flex items-baseline justify-between mb-6">
            <p className="kicker" style={{ color: 'var(--accent)' }}>专题</p>
            <Link href="/series" className="kicker text-[var(--muted)] hover:text-[var(--accent)] transition-colors">
              全部专题 →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {seriesList.slice(0, 6).map((item) => (
              <SeriesCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {/* Featured */}
      {featured.length > 0 && (
        <section className="mb-20 border-t border-[var(--border)] pt-14">
          <p className="kicker mb-8">精选</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {featured.map((post) => (
              <FeaturedCard key={post.id} post={post} />
            ))}
          </div>
        </section>
      )}

      {/* Recent */}
      <section className="border-t border-[var(--border)] pt-14">
        <p className="kicker mb-2">最新</p>
        <div className="divide-y divide-[var(--border-subtle)]">
          {recent.map((post) => (
            <PostItem key={post.id} post={post} />
          ))}
        </div>
        {recent.length === 0 && (
          <p className="py-8 text-sm text-[var(--muted)]">暂无文章。</p>
        )}
        <div className="mt-8">
          <Link href="/archive" className="kicker hover:text-[var(--accent)] transition-colors">
            全部文章 →
          </Link>
        </div>
      </section>
    </div>
  )
}
