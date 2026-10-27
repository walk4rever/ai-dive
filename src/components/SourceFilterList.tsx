'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { Post } from '@/types'
import { getSourceLabel } from '@/lib/content'
import { toAuthorDisplay } from '@/lib/author'
import { ArticleListItem } from '@/components/ArticleListItem'
import { ListPageHeader } from '@/components/ListPageHeader'
import { Pagination } from '@/components/Pagination'

type ListPost = Pick<
  Post,
  'id' | 'slug' | 'title' | 'excerpt' | 'published_at' | 'content_type' | 'author_slug' | 'author_display' | 'agent_id'
>

interface SourceFilterListProps {
  posts: ListPost[]
  selectedSource: string | null
  page: number
  perPage: number
  kicker: string
  title: string
  description?: string
  basePath: string
  emptyText: string
}

const ALL = '__all__'

function sourceOf(post: ListPost): string {
  return toAuthorDisplay(post.author_display) ?? getSourceLabel(post.author_slug) ?? '未知'
}

export function SourceFilterList({
  posts,
  selectedSource: initialSource,
  page: initialPage,
  perPage,
  kicker,
  title,
  description,
  basePath,
  emptyText,
}: SourceFilterListProps) {
  const router = useRouter()

  // Derive state directly from props instead of useState + useEffect
  const selected = initialSource || ALL
  const currentPage = initialPage

  const sources = useMemo(() => {
    const counts = new Map<string, number>()
    for (const post of posts) {
      const label = sourceOf(post)
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [posts])

  const filtered = selected === ALL ? posts : posts.filter((post) => sourceOf(post) === selected)

  // Pagination
  const totalFiltered = filtered.length
  const totalPages = Math.ceil(totalFiltered / perPage)
  const startIndex = (currentPage - 1) * perPage
  const endIndex = startIndex + perPage
  const paginatedPosts = filtered.slice(startIndex, endIndex)

  const handleSourceChange = (source: string) => {
    const params = new URLSearchParams()
    if (source !== ALL) params.set('source', source)
    // Reset to page 1 when changing source
    const query = params.toString()
    router.push(query ? `${basePath}?${query}` : basePath)
  }

  const queryParams: Record<string, string> = selected !== ALL ? { source: selected } : {}

  return (
    <div>
      <ListPageHeader
        kicker={kicker}
        title={title}
        description={description}
        filters={
          posts.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <PillButton active={selected === ALL} onClick={() => handleSourceChange(ALL)}>
                全部 ({posts.length})
              </PillButton>
              {sources.map(([label, count]) => (
                <PillButton key={label} active={selected === label} onClick={() => handleSourceChange(label)}>
                  {label} ({count})
                </PillButton>
              ))}
            </div>
          )
        }
      />
      {posts.length === 0 ? (
        <p className="py-8 text-sm text-[var(--muted)]">{emptyText}</p>
      ) : (
        <>
          <div className="divide-y divide-[var(--border-subtle)]">
            {paginatedPosts.map((post) => (
              <ArticleListItem key={post.id} post={post} />
            ))}
            {paginatedPosts.length === 0 && (
              <p className="py-8 text-sm text-[var(--muted)]">没有匹配的内容。</p>
            )}
          </div>
          {totalFiltered > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              total={totalFiltered}
              basePath={basePath}
              queryParams={queryParams}
            />
          )}
        </>
      )}
    </div>
  )
}

function PillButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'px-3 py-1.5 rounded-full text-[0.8rem] font-medium transition-colors border',
        active
          ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
          : 'text-[var(--foreground-soft)] border-[var(--border)] hover:bg-[var(--accent-light)] hover:text-[var(--accent)]',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
