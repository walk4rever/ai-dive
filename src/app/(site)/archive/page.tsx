import { createClient } from '@/lib/supabase/server'
import { getSupabaseEnv } from '@/lib/supabase/env'
import { Post } from '@/types'
import { ArticleListItem } from '@/components/ArticleListItem'
import { ListPageHeader } from '@/components/ListPageHeader'
import { Pagination } from '@/components/Pagination'

export const revalidate = 60

export const metadata = {
  title: '全部文章 | AI-DIVE',
}

type ArchivePost = Pick<Post, 'id' | 'slug' | 'title' | 'excerpt' | 'published_at' | 'content_type' | 'author_slug' | 'author_display' | 'agent_id'>

interface Props {
  searchParams: Promise<{ page?: string }>
}

export default async function ArchivePage({ searchParams }: Props) {
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
      .order('published_at', { ascending: false })
      .order('created_at', { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1),
    supabase
      .from('ai_pulse_stories')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published')
  ])

  const allPosts = (posts ?? []) as ArchivePost[]
  const total = count ?? 0
  const totalPages = Math.ceil(total / perPage)

  return (
    <div>
      <ListPageHeader
        kicker="Archive"
        title="全部文章"
        description="归档沉淀下来的思想结晶与技术记录；提供完备的时间检索体系，方便随时回溯本站创刊以来发布的所有历史篇章。"
        count={total}
      />
      <div className="divide-y divide-[var(--border-subtle)]">
        {allPosts.map((post) => (
          <ArticleListItem key={post.id} post={post} showType showExcerpt={false} />
        ))}
        {allPosts.length === 0 && (
          <p className="py-8 text-sm text-[var(--muted)]">暂无文章。</p>
        )}
      </div>
      {total > 0 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          total={total}
          basePath="/archive"
        />
      )}
    </div>
  )
}
