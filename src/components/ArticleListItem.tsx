import Link from 'next/link'
import type { Post } from '@/types'
import { getTypeLabel, getSourceLabel } from '@/lib/content'
import { toAuthorDisplay } from '@/lib/author'
import { intelDatePath } from '@/lib/intel-links'

type ListPost = Pick<
  Post,
  'id' | 'slug' | 'title' | 'excerpt' | 'published_at' | 'content_type'
> &
  Partial<Pick<Post, 'author_slug' | 'author_display' | 'agent_id'>>

interface ArticleListItemProps {
  post: ListPost
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null
  const d = new Date(value)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

function postHref(post: ListPost): string {
  if (post.content_type === 'intel') {
    return intelDatePath(post.slug.replace('intel-', ''))
  }
  return `/post/${post.slug}`
}

export function ArticleListItem({ post }: ArticleListItemProps) {
  const sourceLabel =
    toAuthorDisplay(post.author_display) ??
    getSourceLabel(post.author_slug ?? null) ??
    getTypeLabel(post.content_type)
  const date = formatDate(post.published_at)

  return (
    <article className="py-6">
      <Link href={postHref(post)} className="group block">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[0.65rem] font-medium tracking-wide text-[var(--accent)] bg-[var(--accent-light)] border border-[rgba(196,58,69,0.15)] px-2 py-0.5 rounded-full">
            {sourceLabel}
          </span>
          {date && <span className="date shrink-0">{date}</span>}
        </div>
        <h3 className="mt-3 font-serif text-lg md:text-xl font-semibold leading-snug group-hover:text-[var(--accent)] transition-colors">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="mt-2 text-sm md:text-base text-[var(--muted)] leading-relaxed line-clamp-2">
            {post.excerpt}
          </p>
        )}
      </Link>
    </article>
  )
}
