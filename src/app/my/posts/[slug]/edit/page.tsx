import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { loginHref } from '@/lib/auth/client'
import { createServiceClient } from '@/lib/supabase/server'
import { MyPostEditClient, type EditablePost } from '@/components/MyPostEditClient'

interface PageParams {
  params: Promise<{ slug: string }>
}

export default async function MyPostEditPage({ params }: PageParams) {
  const session = await getServerSession(authOptions)
  if (!session) redirect(loginHref('/my/posts'))

  const { slug } = await params
  const supabase = await createServiceClient()
  const { data: post } = await supabase
    .from('ai_pulse_stories')
    .select('slug, agent_id, user_id, title, content, body_markdown, excerpt, featured, status, published_at, is_premium, content_type, author_slug, author_display')
    .eq('slug', slug)
    .eq('user_id', session.user.id)
    .single()

  if (!post) redirect('/my/posts')

  return <MyPostEditClient post={post as EditablePost} />
}
