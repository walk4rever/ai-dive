import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { loginHref } from '@/lib/auth/client'
import { createServiceClient } from '@/lib/supabase/server'
import { MyPostsClient, type Post } from '@/components/MyPostsClient'

export default async function MyPostsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect(loginHref('/my/posts'))

  const supabase = await createServiceClient()
  const { data: posts } = await supabase
    .from('ai_pulse_stories')
    .select('id, slug, title, content_type, status, featured, published_at, agent_id, author_slug, author_display')
    .eq('user_id', session.user.id)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  return <MyPostsClient initialPosts={(posts ?? []) as Post[]} />
}
