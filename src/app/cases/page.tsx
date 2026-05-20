import { createClient } from '@/lib/supabase/server'
import { getSupabaseEnv } from '@/lib/supabase/env'
import { Post } from '@/types'
import { ArticleListItem } from '@/components/ArticleListItem'
import { ListPageHeader } from '@/components/ListPageHeader'

export const revalidate = 60

export const metadata = {
  title: '案例 | AI-DIVE',
}

type ListPost = Pick<Post, 'id' | 'slug' | 'title' | 'excerpt' | 'published_at' | 'content_type'>

export default async function CasesPage() {
  const { hasPublicEnv } = getSupabaseEnv()
  if (!hasPublicEnv) return <p className="text-sm text-[var(--muted)]">配置未完成。</p>

  const supabase = await createClient()
  const { data: posts } = await supabase
    .from('ai_pulse_stories')
    .select('id, slug, title, excerpt, published_at, content_type')
    .eq('status', 'published')
    .eq('content_type', 'case')
    .order('published_at', { ascending: false }).order('created_at', { ascending: false })

  const allPosts = (posts ?? []) as ListPost[]

  return (
    <div>
      <ListPageHeader
        kicker="Cases"
        title="案例"
        description="拆解真实项目与硬核技术决策；还原先锋团队如何穿越 Demo 迷雾，在实践中将 AI 技术锻造成可交付的工业级产品。"
        count={allPosts.length}
      />
      <div className="divide-y divide-[var(--border-subtle)]">
        {allPosts.map((post) => (
          <ArticleListItem key={post.id} post={post} />
        ))}
        {allPosts.length === 0 && (
          <p className="py-8 text-sm text-[var(--muted)]">案例即将发布。</p>
        )}
      </div>
    </div>
  )
}
