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
  const [{ data: posts }, { data: sends }] = await Promise.all([
    supabase
      .from('ai_pulse_stories')
      .select('id, slug, title, content_type, author_slug, author_display, status, featured, published_at')
      .order('published_at', { ascending: false })
      .order('created_at', { ascending: false }),
    // Distinct story_ids that have at least one send row — cheap today (email_sends
    // is a handful of rows), but this re-scans the whole table on every page load; if
    // it ever grows past a few thousand rows, replace with a DB view/RPC that does the
    // distinct server-side instead of deduping in JS below.
    supabase.from('ai_pulse_email_sends').select('story_id'),
  ])

  const sentStoryIds = [...new Set((sends ?? []).map((row) => row.story_id as string).filter(Boolean))]

  return <AdminConsoleClient initialPosts={(posts ?? []) as AdminPost[]} sentStoryIds={sentStoryIds} />
}
