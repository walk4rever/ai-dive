import { createClient } from '@/lib/supabase/server'
import { getSupabaseEnv } from '@/lib/supabase/env'
import { Post } from '@/types'
import { SourceFilterList } from '@/components/SourceFilterList'

export const revalidate = 60

export const metadata = {
  title: '深度 | AI-DIVE',
}

type ListPost = Pick<
  Post,
  'id' | 'slug' | 'title' | 'excerpt' | 'published_at' | 'content_type' | 'author_slug' | 'author_display' | 'agent_id'
>

interface Props {
  searchParams: Promise<{ source?: string; page?: string }>
}

export default async function DivesPage({ searchParams }: Props) {
  const { hasPublicEnv } = getSupabaseEnv()
  if (!hasPublicEnv) return <p className="text-sm text-[var(--muted)]">配置未完成。</p>

  const sp = await searchParams
  const selectedSource = sp.source?.trim() || null
  const page = Math.max(1, Number(sp.page) || 1)
  const perPage = 30

  const supabase = await createClient()

  // Fetch all posts for source filtering (client-side)
  const { data: posts } = await supabase
    .from('ai_pulse_stories')
    .select('id, slug, title, excerpt, published_at, content_type, author_slug, author_display, agent_id')
    .eq('status', 'published')
    .eq('content_type', 'dive')
    .order('published_at', { ascending: false })
    .order('created_at', { ascending: false })

  const allPosts = (posts ?? []) as ListPost[]

  return (
    <SourceFilterList
      posts={allPosts}
      selectedSource={selectedSource}
      page={page}
      perPage={perPage}
      kicker="Dives"
      title="深度"
      description="围绕前沿技术、工程实践与关键人物的深度剖析；从学术前沿到工程落地，从对话亲历者到产品复盘，探寻变革背后真正的长期主义逻辑。"
      basePath="/dives"
      emptyText="深度文章即将发布。"
    />
  )
}
