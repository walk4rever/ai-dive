import { createServiceClient } from '@/lib/supabase/server'
import { fetchAdminPostsData } from '@/lib/admin/posts'
import { PostsManager } from './PostsManager'

export default async function AdminPostsPage() {
  const supabase = await createServiceClient()
  const { posts, sentStoryIds } = await fetchAdminPostsData(supabase)

  return <PostsManager initialPosts={posts} sentStoryIds={sentStoryIds} />
}
