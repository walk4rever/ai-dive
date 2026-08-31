import type { SupabaseClient } from '@supabase/supabase-js'

export interface AdminPost {
  id: string
  slug: string
  title: string
  content_type: string
  author_slug: string | null
  status: string
  featured: boolean
  published_at: string | null
}

export interface AdminPostsData {
  posts: AdminPost[]
  /** story ids with at least one row in ai_pulse_email_sends — used to compute which
   *  published posts still haven't gone out as a newsletter. */
  sentStoryIds: string[]
}

/** Shared by the overview page and the posts-management page — same query, same
 *  distinct-story-id computation, used in two places so it can't drift out of sync.
 *  The email_sends query re-scans the whole table on every load; cheap today (a
 *  handful of rows), but if it ever grows past a few thousand, replace with a DB
 *  view/RPC that computes the distinct set server-side instead of deduping in JS. */
export async function fetchAdminPostsData(supabase: SupabaseClient): Promise<AdminPostsData> {
  const [{ data: posts }, { data: sends }] = await Promise.all([
    supabase
      .from('ai_pulse_stories')
      .select('id, slug, title, content_type, author_slug, author_display, status, featured, published_at')
      .order('published_at', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('ai_pulse_email_sends').select('story_id'),
  ])

  const sentStoryIds = [...new Set((sends ?? []).map((row) => row.story_id as string).filter(Boolean))]

  return { posts: (posts ?? []) as AdminPost[], sentStoryIds }
}
