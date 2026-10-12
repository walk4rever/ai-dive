export type PostListStatusFilter = 'all' | 'draft' | 'published' | 'featured'

export function matchesPostListStatus(
  post: { status: string; featured: boolean },
  filter: PostListStatusFilter
): boolean {
  if (filter === 'all') return true
  if (filter === 'featured') return post.featured
  return post.status === filter
}
