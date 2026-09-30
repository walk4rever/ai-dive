import { createClient } from '@/lib/supabase/server'
import { getSupabaseEnv } from '@/lib/supabase/env'
import { Post } from '@/types'
import { ArticleListItem } from '@/components/ArticleListItem'
import { ListPageHeader } from '@/components/ListPageHeader'
import { Pagination } from '@/components/Pagination'

export const revalidate = 60

export const metadata = {
  title: '深度 | AI-DIVE',
}

type ListPost = Pick<Post, 'id' | 'slug' | 'title' | 'excerpt' | 'published_at' | 'content_type' | 'author_slug' | 'author_display' | 'agent_id'>

interface Props {
  searchParams: Promise<{ page?: string }>
}

export default async function DivesPage({ searchParams }: Props) {
  const { hasPublicEnv } = getSupabaseEnv()
  if (!hasPublicEnv) return <p className="text-sm text-[var(--muted)]">配置未完成。</p>

  const sp = await searchParams
  const page = Math.max(1, Number(sp.page) || 1)
  const perPage = 30

  const supabase = await createClient()

  const [{ data: posts }, { count }] = await Promise.all([
    supabase
      .from('ai_pulse_stories')
      .select('id, slug, title, excerpt, published_at, content_type, author_slug, author_display, agent_id')
      .eq('status', 'published')
      .eq('content_type', 'dive')
      .order('published_at', { ascending: false })
      .order('created_at', { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1),
    supabase
      .from('ai_pulse_stories')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published')
      .eq('content_type', 'dive')
  ])

  const allPosts = (posts ?? []) as ListPost[]
  const total = count ?? 0
  const totalPages = Math.ceil(total / perPage)

  return (
    <div>
      <ListPageHeader
        kicker="Dives"
        title="深度"
        description="围绕产品、技术与真实项目的深度剖析；从学术前沿到工程决策，从产品解析到团队复盘，探寻变革背后真正的长期主义逻辑。"
        count={total}
      />
      <div className="divide-y divide-[var(--border-subtle)]">
        {allPosts.map((post) => (
          <ArticleListItem key={post.id} post={post} showSource />
        ))}
        {allPosts.length === 0 && (
          <p className="py-8 text-sm text-[var(--muted)]">深度文章即将发布。</p>
        )}
      </div>
      {total > 0 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          total={total}
          basePath="/dives"
        />
      )}
    </div>
  )
}
