'use client'

import { useMemo, useState } from 'react'
import type { Post } from '@/types'
import { getSourceLabel } from '@/lib/content'
import { ArticleListItem } from '@/components/ArticleListItem'
import { ListPageHeader } from '@/components/ListPageHeader'

type ListPost = Pick<
  Post,
  'id' | 'slug' | 'title' | 'excerpt' | 'published_at' | 'content_type' | 'author_slug' | 'author_display' | 'agent_id'
>

interface InsightsListProps {
  posts: ListPost[]
}

const ALL = '__all__'

function sourceOf(post: ListPost): string {
  return post.author_display ?? getSourceLabel(post.author_slug) ?? '未知'
}

export function InsightsList({ posts }: InsightsListProps) {
  const [selected, setSelected] = useState(ALL)

  const sources = useMemo(() => {
    const counts = new Map<string, number>()
    for (const post of posts) {
      const label = sourceOf(post)
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [posts])

  const filtered = selected === ALL ? posts : posts.filter((post) => sourceOf(post) === selected)

  return (
    <div>
      <ListPageHeader
        kicker="Insights"
        title="洞见"
        description="对话大模型时代的现场亲历者；在思想碰撞与深度访谈中，倾听技术与商业最前沿那些不为人知的关键决策时刻。"
        filters={
          posts.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <PillButton active={selected === ALL} onClick={() => setSelected(ALL)}>
                全部 ({posts.length})
              </PillButton>
              {sources.map(([label, count]) => (
                <PillButton key={label} active={selected === label} onClick={() => setSelected(label)}>
                  {label} ({count})
                </PillButton>
              ))}
            </div>
          )
        }
      />
      {posts.length === 0 ? (
        <p className="py-8 text-sm text-[var(--muted)]">洞见内容即将发布。</p>
      ) : (
        <div className="divide-y divide-[var(--border-subtle)]">
          {filtered.map((post) => (
            <ArticleListItem key={post.id} post={post} showSource />
          ))}
          {filtered.length === 0 && (
            <p className="py-8 text-sm text-[var(--muted)]">没有匹配的内容。</p>
          )}
        </div>
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
