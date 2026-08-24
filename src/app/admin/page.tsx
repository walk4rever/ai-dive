import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { loginHref } from '@/lib/auth/client'
import { createServiceClient } from '@/lib/supabase/server'
import { AdminConsoleClient, type AdminPost } from './AdminConsoleClient'

export default async function AdminPage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') redirect(loginHref('/admin'))

  const supabase = await createServiceClient()
  const { data: posts } = await supabase
    .from('ai_pulse_stories')
    .select('id, slug, title, content_type, author_slug, author_display, status, featured, published_at')
    .order('published_at', { ascending: false })
    .order('created_at', { ascending: false })

  return <AdminConsoleClient initialPosts={(posts ?? []) as AdminPost[]} />
}
