'use client'

import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { getTypeLabel } from '@/lib/content'
import type { AdminPost } from '@/lib/admin/posts'
import { Card } from '@/components/ui/Card'

type StatusFilter = 'all' | 'draft' | 'published'
type TypeFilter = 'all' | 'dive' | 'intel' | 'insight'
/** 'all' shows everything the other filters allow; 'featured' and 'pending' are the
 *  quick filters the overview page's stat tiles link into (?filter=pending etc.) —
 *  mutually exclusive with each other, layered on top of the text/type/status filters. */
type QuickFilter = 'all' | 'featured' | 'pending'

function formatDate(value: string | null) {
  if (!value) return '未发布'
  const d = new Date(value)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

interface PostsManagerProps {
  initialPosts: AdminPost[]
  /** story ids with at least one row in ai_pulse_email_sends — see fetchAdminPostsData. */
  sentStoryIds: string[]
}

export function PostsManager(props: PostsManagerProps) {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">加载中...</p>}>
      <PostsManagerInner {...props} />
    </Suspense>
  )
}

function PostsManagerInner({ initialPosts, sentStoryIds }: PostsManagerProps) {
  const searchParams = useSearchParams()
  const filterParam = searchParams.get('filter')
  const initialQuick: QuickFilter = filterParam === 'pending' || filterParam === 'featured' ? filterParam : 'all'

  const [posts, setPosts] = useState<AdminPost[]>(initialPosts)
  const sentIds = useMemo(() => new Set(sentStoryIds), [sentStoryIds])

  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(initialQuick)
  const [page, setPage] = useState(1)
  const pageSize = 50

  const [busySlug, setBusySlug] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')

  const refreshPosts = async () => {
    const res = await fetch('/api/admin/posts')
    const data = await res.json()
    setPosts(data.posts ?? [])
  }

  function resetFilters() {
    setQuery('')
    setTypeFilter('all')
    setStatusFilter('all')
    setQuickFilter('all')
  }

  const featuredCount = useMemo(() => posts.filter((p) => p.featured).length, [posts])

  async function toggleFeatured(slug: string, current: boolean, contentType: string) {
    if (!current && !['dive', 'insight'].includes(contentType)) {
      alert('只有深度、洞见类型的文章可以设为精选。')
      return
    }
    if (!current && featuredCount >= 3) {
      alert('最多精选 3 篇，请先取消其他精选文章。')
      return
    }
    setBusySlug(slug)
    setActionError('')
    const res = await fetch(`/api/admin/posts/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ featured: !current }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setActionError(data?.error ?? '操作失败，请重试')
      setBusySlug(null)
      return
    }
    await refreshPosts()
    setBusySlug(null)
  }

  async function deletePost(slug: string) {
    if (!confirm(`确认删除「${slug}」？此操作不可撤销。`)) return
    setBusySlug(slug)
    setActionError('')
    const res = await fetch(`/api/admin/posts/${slug}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setActionError(data?.error ?? '删除失败，请重试')
      setBusySlug(null)
      return
    }
    await refreshPosts()
    setBusySlug(null)
  }

  const filteredPosts = useMemo(() => {
    const q = query.trim().toLowerCase()
    return posts.filter((post) => {
      if (q && !post.title.toLowerCase().includes(q) && !post.slug.toLowerCase().includes(q)) return false
      if (typeFilter !== 'all' && post.content_type !== typeFilter) return false
      if (statusFilter !== 'all' && post.status !== statusFilter) return false
      if (quickFilter === 'featured' && !post.featured) return false
      if (quickFilter === 'pending' && (post.status !== 'published' || sentIds.has(post.id))) return false
      return true
    })
  }, [posts, query, typeFilter, statusFilter, quickFilter, sentIds])

  // Any filter change can shrink the result set below the current page — snap back to
  // page 1 during render (React's "adjust state during render" pattern for derived
  // state) rather than an effect, so it doesn't cascade.
  const filterKey = `${query}|${typeFilter}|${statusFilter}|${quickFilter}`
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey)
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey)
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / pageSize))
  const pagedPosts = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredPosts.slice(start, start + pageSize)
  }, [page, filteredPosts])

  const filtersActive = query !== '' || typeFilter !== 'all' || statusFilter !== 'all' || quickFilter !== 'all'

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <p className="kicker">Editorial Queue</p>
          <p className="font-serif text-2xl font-medium tracking-tight mt-1">文章管理</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1}
              className="rounded-[var(--radius-md)] px-3 py-1.5 text-xs border border-[var(--border)] disabled:opacity-40"
            >
              上一页
            </button>
            <span className="text-xs text-[var(--muted)]">
              第 {page} / {totalPages} 页
            </span>
            <button
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              className="rounded-[var(--radius-md)] px-3 py-1.5 text-xs border border-[var(--border)] disabled:opacity-40"
            >
              下一页
            </button>
          </div>
          <Link
            href="/admin/new"
            className="rounded-[var(--radius-md)] bg-[var(--foreground)] px-3.5 py-2 text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-80"
          >
            新建文章
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索标题或 slug…"
          className="flex-1 min-w-[180px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)] transition"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)] transition"
        >
          <option value="all">全部类型</option>
          <option value="dive">深度</option>
          <option value="intel">情报</option>
          <option value="insight">洞见</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)] transition"
        >
          <option value="all">全部状态</option>
          <option value="draft">草稿</option>
          <option value="published">发布</option>
        </select>
        {quickFilter !== 'all' && (
          <span className="flex items-center gap-2 rounded-full px-3 py-2 text-xs kicker text-[var(--accent)] border border-[var(--accent)] border-opacity-40">
            {quickFilter === 'pending' ? '待发 Newsletter' : '精选'}
            <button onClick={() => setQuickFilter('all')} className="hover:opacity-60">✕</button>
          </span>
        )}
        {filtersActive && (
          <button
            onClick={resetFilters}
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            清除筛选
          </button>
        )}
      </div>

      {actionError && (
        <p className="mb-3 text-sm text-[var(--accent)]">{actionError}</p>
      )}

      <div className="hidden md:grid md:grid-cols-[110px_90px_1fr_70px_170px] md:gap-3 px-2 pb-2 border-b border-[var(--border)] text-xs text-[var(--muted)]">
        <span>日期</span>
        <span>类型</span>
        <span>标题</span>
        <span>状态</span>
        <span className="text-right">操作</span>
      </div>

      {pagedPosts.length === 0 ? (
        <p className="py-8 text-sm text-[var(--muted)] text-center">没有匹配的文章。</p>
      ) : (
        <div className="divide-y divide-[var(--border-subtle)]">
          {pagedPosts.map((post) => {
            const busy = busySlug === post.slug
            return (
              <div key={post.id} className="py-3 md:grid md:grid-cols-[110px_90px_1fr_70px_170px] md:items-center gap-3 px-2">
                <p className="date">{formatDate(post.published_at)}</p>
                <p className="kicker mt-1 md:mt-0">{getTypeLabel(post.content_type)}</p>
                <div className="mt-2 md:mt-0 min-w-0">
                  <a
                    href={`/post/${post.slug}`}
                    target="_blank"
                    className="text-sm leading-snug hover:text-[var(--accent)] transition-colors"
                  >
                    {post.title}
                  </a>
                  <p className="text-xs text-[var(--muted)] mt-1">{post.author_slug || '—'}</p>
                </div>
                <p className="kicker mt-2 md:mt-0">
                  {post.status === 'draft' ? '草稿' : '发布'}
                </p>
                <div className="mt-3 md:mt-0 flex md:justify-end items-center gap-3">
                  <a
                    href={`/admin/edit/${post.slug}`}
                    className="kicker text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                  >
                    编辑
                  </a>
                  <button
                    onClick={() => toggleFeatured(post.slug, post.featured, post.content_type)}
                    disabled={busy}
                    className={`kicker transition-colors disabled:opacity-40 ${post.featured ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]'}`}
                  >
                    {post.featured ? '★ 精选' : '☆ 精选'}
                  </button>
                  <button
                    onClick={() => deletePost(post.slug)}
                    disabled={busy}
                    className="kicker text-[var(--muted)] hover:text-red-500 transition-colors disabled:opacity-40"
                  >
                    {busy ? '处理中…' : '删除'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {filteredPosts.length > pageSize && (
        <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between">
          <p className="text-xs text-[var(--muted)]">共 {filteredPosts.length} 篇，每页 {pageSize} 篇</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1}
              className="rounded-[var(--radius-md)] px-3 py-1.5 text-xs border border-[var(--border)] disabled:opacity-40"
            >
              上一页
            </button>
            <span className="text-xs text-[var(--muted)]">
              {page}/{totalPages}
            </span>
            <button
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              className="rounded-[var(--radius-md)] px-3 py-1.5 text-xs border border-[var(--border)] disabled:opacity-40"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}
