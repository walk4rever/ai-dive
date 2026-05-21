import { createClient } from '@/lib/supabase/server'
import { getSupabaseEnv } from '@/lib/supabase/env'
import { Post } from '@/types'
import { ArticleListItem } from '@/components/ArticleListItem'
import { ListPageHeader } from '@/components/ListPageHeader'

export const revalidate = 60

export const metadata = {
  title: '播客 | AI-DIVE',
}

type ListPost = Pick<Post, 'id' | 'slug' | 'title' | 'excerpt' | 'published_at' | 'content_type' | 'content'>

function extractFirstImageUrlFromHtml(html: string): string | null {
  const match = html.match(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/i)
  return match?.[1] ? match[1] : null
}

export default async function PodcastPage() {
  const { hasPublicEnv } = getSupabaseEnv()
  if (!hasPublicEnv) return <p className="text-sm text-[var(--muted)]">配置未完成。</p>

  const supabase = await createClient()
  const { data: posts } = await supabase
    .from('ai_pulse_stories')
    .select('id, slug, title, excerpt, published_at, content_type, content')
    .eq('status', 'published')
    .eq('content_type', 'podcast')
    .order('published_at', { ascending: false }).order('created_at', { ascending: false })

  const allPosts = (posts ?? []) as ListPost[]

  return (
    <div>
      <ListPageHeader
        kicker="Podcast"
        title="播客"
        description="对话大模型时代的现场亲历者；在思想碰撞与深度访谈中，倾听技术与商业最前沿那些不为人知的关键决策时刻。"
        count={allPosts.length}
      />
      <div className="divide-y divide-[var(--border-subtle)]">
        {allPosts.map((post) => (
          <ArticleListItem key={post.id} post={post} coverUrl={extractFirstImageUrlFromHtml(post.content)} />
        ))}
        {allPosts.length === 0 && (
          <p className="py-8 text-sm text-[var(--muted)]">播客内容即将发布。</p>
        )}
      </div>
    </div>
  )
}
