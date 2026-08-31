import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchAdminPostsData } from '@/lib/admin/posts'
import { fetchAdminDecks } from '@/lib/admin/decks'
import { fetchAdminSubscribers } from '@/lib/admin/subscribers'
import { getTypeLabel } from '@/lib/content'
import { Card } from '@/components/ui/Card'

function formatDate(value: string | null) {
  if (!value) return '未发布'
  const d = new Date(value)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

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

export default async function AdminOverviewPage() {
  const supabase = await createServiceClient()
  const [{ posts, sentStoryIds }, decks, subscribers] = await Promise.all([
    fetchAdminPostsData(supabase),
    fetchAdminDecks(supabase),
    fetchAdminSubscribers(supabase),
  ])
  const sentIds = new Set(sentStoryIds)

  const featuredCount = posts.filter((p) => p.featured).length
  const pendingNewsletterCount = posts.filter((p) => p.status === 'published' && !sentIds.has(p.id)).length
  const recentPosts = posts.filter((p) => p.status === 'published').slice(0, 8)
  const unpricedDeckCount = decks.filter((d) => d.status === 'published' && d.price_cents === null).length
  const activeSubscriberCount = subscribers.filter((s) => s.status === 'active').length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatLink label="文章总数" value={posts.length} href="/admin/posts" />
        <StatLink label="待发 Newsletter" value={pendingNewsletterCount} href="/admin/posts?filter=pending" />
        <StatLink label="精选" value={`${featuredCount} / 3`} href="/admin/posts?filter=featured" />
        <StatLink label="未定价出品" value={`${unpricedDeckCount} / ${decks.length}`} href="/admin/decks" />
        <StatLink label="已订阅" value={activeSubscriberCount} href="/admin/subscribers" />
      </div>

      <Card kicker="最近发布">
        {recentPosts.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">还没有发布任何文章。</p>
        ) : (
          <div className="mt-2 divide-y divide-[var(--border-subtle)]">
            {recentPosts.map((post) => (
              <div key={post.id} className="py-3 flex items-center gap-4">
                <p className="date w-20 shrink-0">{formatDate(post.published_at)}</p>
                <p className="kicker w-12 shrink-0">{getTypeLabel(post.content_type)}</p>
                <Link
                  href={`/admin/edit/${post.slug}`}
                  className="min-w-0 flex-1 truncate text-sm hover:text-[var(--accent)] transition-colors"
                >
                  {post.title}
                </Link>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
