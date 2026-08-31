import { createClient } from '@/lib/supabase/server'
import { getSupabaseEnv } from '@/lib/supabase/env'
import { Post } from '@/types'
import { ArticleListItem } from '@/components/ArticleListItem'
import { ListPageHeader } from '@/components/ListPageHeader'

export const revalidate = 60

export const metadata = {
  title: '全部文章 | AI-DIVE',
}

type ArchivePost = Pick<Post, 'id' | 'slug' | 'title' | 'excerpt' | 'published_at' | 'content_type'>

export default async function ArchivePage() {
  const { hasPublicEnv } = getSupabaseEnv()

  if (!hasPublicEnv) {
    return <p className="text-sm text-[var(--muted)]">配置未完成。</p>
  }

  const supabase = await createClient()
  const { data: posts } = await supabase
    .from('ai_pulse_stories')
    .select('id, slug, title, excerpt, published_at, content_type')
    .eq('status', 'published')
    .order('published_at', { ascending: false }).order('created_at', { ascending: false })

  const allPosts = (posts ?? []) as ArchivePost[]

  return (
    <div>
      <ListPageHeader
        kicker="Archive"
        title="全部文章"
        description="归档沉淀下来的思想结晶与技术记录；提供完备的时间检索体系，方便随时回溯本站创刊以来发布的所有历史篇章。"
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
