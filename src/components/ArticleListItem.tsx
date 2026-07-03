import Link from 'next/link'
import Image from 'next/image'
import type { Post } from '@/types'
import { getTypeLabel, getSourceLabel } from '@/lib/content'

type ListPost = Pick<
  Post,
  'id' | 'slug' | 'title' | 'excerpt' | 'published_at' | 'content_type'
> &
  Partial<Pick<Post, 'author_slug' | 'agent_id'>>

interface ArticleListItemProps {
  post: ListPost
  showType?: boolean
  showExcerpt?: boolean
  showSource?: boolean
  coverUrl?: string | null
}

function formatDateParts(value: string | null | undefined): { monthDay: string; year: string } | null {
  if (!value) return null
  const d = new Date(value)
  return {
    monthDay: `${d.getMonth() + 1}月${d.getDate()}日`,
    year: `${d.getFullYear()}年`,
  }
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
  showSource = false,
  coverUrl,
}: ArticleListItemProps) {
  const sourceLabel = showSource && !post.agent_id ? getSourceLabel(post.author_slug ?? null) : null
  const dateParts = formatDateParts(post.published_at)

  return (
    <article className="py-7">
      <div className="flex items-start justify-between gap-6">
        <div className="flex items-start gap-5 flex-1 min-w-0">
          {dateParts && (
            <div className="hidden sm:flex flex-col items-center justify-center self-stretch shrink-0 w-16 pr-4 text-center border-r border-[var(--border-subtle)]">
              <span className="font-serif text-lg leading-none font-medium text-[var(--foreground-soft)] whitespace-nowrap">
                {dateParts.monthDay}
              </span>
              <span className="date mt-1.5">{dateParts.year}</span>
            </div>
          )}
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
            {dateParts && (
              <span className="date mt-2 block sm:hidden">
                {dateParts.monthDay} {dateParts.year}
              </span>
            )}
          </div>
        </div>
        {(sourceLabel || showType) && (
          <div className="flex items-center gap-3 shrink-0 pt-1">
            {sourceLabel && (
              <span className="text-[0.65rem] font-medium tracking-wide text-[var(--accent)] bg-[var(--accent-light)] border border-[rgba(201,100,66,0.15)] px-2 py-0.5 rounded-full">
                {sourceLabel}
              </span>
            )}
            {showType && (
              <span className="kicker" style={{ color: 'var(--accent)' }}>
                {getTypeLabel(post.content_type)}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
