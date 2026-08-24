import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { loginHref } from '@/lib/auth/client'
import { createServiceClient } from '@/lib/supabase/server'
import { EditForm } from './EditForm'

interface PageParams {
  params: Promise<{ slug: string }>
}

export default async function EditPage({ params }: PageParams) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') redirect(loginHref('/admin'))

  const { slug } = await params
  const supabase = await createServiceClient()
  const { data: post } = await supabase
    .from('ai_pulse_stories')
    .select('slug, title, content, body_markdown, excerpt, featured, status, published_at, is_premium, content_type, author_slug, author_display')
    .eq('slug', slug)
    .single()

  if (!post) redirect('/admin')

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <a href="/admin" className="kicker text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
            ← 返回列表
          </a>
          <a href={`/post/${post.slug}`} target="_blank" className="kicker text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
            查看文章 →
          </a>
        </div>
        <p className="text-lg font-semibold mb-6">编辑文章</p>
        <EditForm post={post} />
      </div>
    </div>
  )
}
