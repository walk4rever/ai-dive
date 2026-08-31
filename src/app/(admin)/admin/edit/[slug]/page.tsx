import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { EditForm } from './EditForm'

interface PageParams {
  params: Promise<{ slug: string }>
}

export default async function EditPage({ params }: PageParams) {
  const { slug } = await params
  const supabase = await createServiceClient()
  const { data: post } = await supabase
    .from('ai_pulse_stories')
    .select('slug, title, content, body_markdown, excerpt, featured, status, published_at, is_premium, content_type, author_slug, author_display')
    .eq('slug', slug)
    .single()

  if (!post) redirect('/admin/posts')

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-8">
        <a href="/admin/posts" className="kicker text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
          ← 返回列表
        </a>
        <a href={`/post/${post.slug}`} target="_blank" className="kicker text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
          查看文章 →
        </a>
      </div>
      <p className="font-serif text-2xl font-medium mb-6">编辑文章</p>
      <EditForm post={post} />
    </div>
  )
}
