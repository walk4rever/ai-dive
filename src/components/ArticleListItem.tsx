import Link from 'next/link'
import Image from 'next/image'
import type { Post } from '@/types'
import { getTypeLabel } from '@/lib/content'

type ListPost = Pick<
  Post,
  'id' | 'slug' | 'title' | 'excerpt' | 'published_at' | 'content_type'
>

interface ArticleListItemProps {
  post: ListPost
  showType?: boolean
  showExcerpt?: boolean
  coverUrl?: string | null
}

function formatDate(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function shouldOptimizeCover(coverUrl: string): boolean {
  try {
    const { hostname } = new URL(coverUrl)
    return hostname === 'pub-675abd2580e643e89dde5e766edae1b7.r2.dev'
  } catch {
    return false
  }
}

export function ArticleListItem({
  post,
  showType = false,
  showExcerpt = true,
  coverUrl,
}: ArticleListItemProps) {
  return (
    <article className="py-7">
      <div className="flex items-start justify-between gap-6">
        <div className="flex items-start gap-5 flex-1 min-w-0">
          {coverUrl && (
            <Link
              href={`/post/${post.slug}`}
              className="relative shrink-0 w-[88px] h-[56px] md:w-[112px] md:h-[70px] rounded-xl overflow-hidden bg-[var(--surface-sand)]"
              aria-label={post.title}
            >
              <Image
                src={coverUrl}
                alt={post.title}
                fill
                sizes="(min-width: 768px) 112px, 88px"
                className="object-cover"
                unoptimized={!shouldOptimizeCover(coverUrl)}
              />
            </Link>
          )}
          <div className="min-w-0">
            <Link href={`/post/${post.slug}`} className="group block">
              <h3 className="font-serif text-lg md:text-xl font-medium leading-snug group-hover:text-[var(--accent)] transition-colors">
                {post.title}
              </h3>
            </Link>
            {showExcerpt && post.excerpt && (
              <p className="mt-2 text-sm md:text-base text-[var(--muted)] leading-relaxed line-clamp-2">
                {post.excerpt}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 pt-1">
          {showType && (
            <span className="kicker" style={{ color: 'var(--accent)' }}>
              {getTypeLabel(post.content_type)}
            </span>
          )}
          <span className="date">{formatDate(post.published_at)}</span>
        </div>
      </div>
    </article>
  )
}
