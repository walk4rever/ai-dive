import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchAdminPostsData } from '@/lib/admin/posts'
import { fetchAdminDecks } from '@/lib/admin/decks'
import { fetchAdminSubscribers } from '@/lib/admin/subscribers'
import { fetchAdminOverviewTrends, type OverviewTrend } from '@/lib/admin/overview-metrics'

/** A stat tile that's also a link straight into the filtered list — the P0 version of
 *  this (the three boxes at the top of the old single-page console) had the same
 *  click-through behavior; it just lived inline instead of on its own overview page. */
function StatLink({ label, value, href }: { label: string; value: string | number; href: string }) {
  return (
    <Link
      href={href}
      className="block rounded-[var(--radius-lg)] border border-[var(--border)] p-6 transition-colors hover:border-[var(--ring)]"
    >
      <p className="kicker">{label}</p>
      <p className="mt-2 font-serif text-3xl font-medium">{value}</p>
    </Link>
  )
}

/** Unlike StatLink (a snapshot), this shows whether the number is moving — last 7
 *  days against the 7 days before, so a flat "已订阅: 342" total can't hide a dead
 *  week. */
function TrendTile({ trend }: { trend: OverviewTrend }) {
  const diff = trend.current - trend.previous
  const diffLabel = diff === 0 ? '与上周持平' : `${diff > 0 ? '+' : ''}${diff} 较上周`
  const diffClass = diff > 0 ? 'text-[var(--accent)]' : diff < 0 ? 'text-[var(--subtle)]' : 'text-[var(--muted)]'

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] p-6">
      <p className="kicker">{trend.label}</p>
      <p className="mt-2 font-serif text-3xl font-medium">{trend.current}</p>
      <div className="mt-2 flex items-baseline gap-2 text-sm">
        <span className={diffClass}>{diffLabel}</span>
        {trend.detail && <span className="text-[var(--muted)]">· {trend.detail}</span>}
      </div>
    </div>
  )
}

export default async function AdminOverviewPage() {
  const supabase = await createServiceClient()
  const [{ posts, sentStoryIds }, decks, subscribers, trends] = await Promise.all([
    fetchAdminPostsData(supabase),
    fetchAdminDecks(supabase),
    fetchAdminSubscribers(supabase),
    fetchAdminOverviewTrends(supabase),
  ])
  const sentIds = new Set(sentStoryIds)

  const featuredCount = posts.filter((p) => p.featured).length
  const pendingNewsletterCount = posts.filter((p) => p.status === 'published' && !sentIds.has(p.id)).length
  const unpricedDeckCount = decks.filter((d) => d.status === 'published' && d.price_cents === null).length
  const activeSubscriberCount = subscribers.filter((s) => s.status === 'active').length

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <p className="kicker">System Overview</p>
        <p className="font-serif text-2xl font-medium tracking-tight mt-1">运行总览</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatLink label="文章总数" value={posts.length} href="/admin/posts" />
        <StatLink label="待发 Newsletter" value={pendingNewsletterCount} href="/admin/posts?filter=pending" />
        <StatLink label="精选" value={`${featuredCount} / 3`} href="/admin/posts?filter=featured" />
        <StatLink label="未定价出品" value={`${unpricedDeckCount} / ${decks.length}`} href="/admin/decks" />
        <StatLink label="已订阅" value={activeSubscriberCount} href="/admin/subscribers" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {trends.map((trend) => (
          <TrendTile key={trend.label} trend={trend} />
        ))}
      </div>
    </div>
  )
}
