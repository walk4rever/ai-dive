import { createClient } from '@/lib/supabase/server'
import { getSupabaseEnv } from '@/lib/supabase/env'
import { Post } from '@/types'
import { ArticleListItem } from '@/components/ArticleListItem'
import { ListPageHeader } from '@/components/ListPageHeader'

export const revalidate = 60

export const metadata = {
  title: '最新 | AI-DIVE',
}

type ListPost = Pick<Post, 'id' | 'slug' | 'title' | 'excerpt' | 'published_at' | 'content_type'>

export default async function LatestPage() {
  const { hasPublicEnv } = getSupabaseEnv()
  if (!hasPublicEnv) return <p className="text-sm text-[var(--muted)]">配置未完成。</p>

  const supabase = await createClient()
  const { data: posts } = await supabase
    .from('ai_pulse_stories')
    .select('id, slug, title, excerpt, published_at, content_type')
    .eq('status', 'published')
    .order('published_at', { ascending: false }).order('created_at', { ascending: false })

  const allPosts = (posts ?? []) as ListPost[]

  return (
    <div>
      <ListPageHeader
        kicker="Latest"
        title="最新"
        description="纵览生成式 AI 领域的每一次呼吸与脉动；按时间线索无缝连接，第一时间向你呈现站点最新发布的所有篇章。"
        count={allPosts.length}
      />
      <div className="divide-y divide-[var(--border-subtle)]">
        {allPosts.map((post) => (
          <ArticleListItem key={post.id} post={post} showType showExcerpt={false} />
        ))}
      </div>
    </div>
  )
}
