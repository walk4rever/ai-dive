'use client'

import { Suspense, useCallback, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { getTypeLabel } from '@/lib/content'
import { SeriesManager } from './SeriesManager'

type AdminTab = 'posts' | 'series'
type StatusFilter = 'all' | 'draft' | 'published'
type TypeFilter = 'all' | 'dive' | 'intel' | 'insight'
/** 'all' shows everything the other filters allow; 'featured' and 'pending' are the
 *  quick filters the stat cards set — mutually exclusive with each other, layered on
 *  top of the text/type/status filters. */
type QuickFilter = 'all' | 'featured' | 'pending'

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

function formatDate(value: string | null) {
  if (!value) return '未发布'
  const d = new Date(value)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

interface AdminConsoleClientProps {
  initialPosts: AdminPost[]
  /** story ids with at least one row in ai_pulse_email_sends — used to compute which
   *  published posts still haven't gone out as a newsletter. */
  sentStoryIds: string[]
}

export function AdminConsoleClient({ initialPosts, sentStoryIds }: AdminConsoleClientProps) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-[var(--muted)]">加载中...</p>
      </div>
    }>
      <AdminConsole initialPosts={initialPosts} sentStoryIds={sentStoryIds} />
    </Suspense>
  )
}

function AdminConsole({ initialPosts, sentStoryIds }: AdminConsoleClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const activeTab: AdminTab = tabParam === 'series' ? 'series' : 'posts'
  const [posts, setPosts] = useState<AdminPost[]>(initialPosts)
  const sentIds = useMemo(() => new Set(sentStoryIds), [sentStoryIds])

  // SeriesManager fetches its own data on mount; keeping it unmounted until the tab is
  // actually opened avoids paying for that fetch on every /admin load. Once visited it
  // stays mounted (behind `hidden`) so switching tabs back and forth doesn't refetch.
  // "Adjust state during render" (React's own pattern for derived state, see "Storing
  // information from previous renders" in the docs) rather than an effect: comparing
  // against a previous-tab snapshot lets this run only on the render where activeTab
  // actually changed, so it doesn't cascade.
  const [seriesEverActive, setSeriesEverActive] = useState(activeTab === 'series')
  const [prevTab, setPrevTab] = useState(activeTab)
  if (activeTab !== prevTab) {
    setPrevTab(activeTab)
    if (activeTab === 'series') setSeriesEverActive(true)
  }

  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [page, setPage] = useState(1)
  const pageSize = 50

  const [busySlug, setBusySlug] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')

  const setActiveTab = useCallback((next: AdminTab) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next === 'posts') {
      params.delete('tab')
    } else {
      params.set('tab', next)
    }
    const qs = params.toString()
    router.replace(qs ? `/admin?${qs}` : '/admin', { scroll: false })
  }, [router, searchParams])

  const refreshPosts = useCallback(async () => {
    const res = await fetch('/api/admin/posts')
    const data = await res.json()
    setPosts(data.posts ?? [])
  }, [])

  function resetFilters() {
    setQuery('')
    setTypeFilter('all')
    setStatusFilter('all')
    setQuickFilter('all')
  }

  async function toggleFeatured(slug: string, current: boolean, featuredCount: number, contentType: string) {
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

  async function handleLogout() {
    await signOut({ redirect: false })
    router.push('/login')
  }

  const featuredCount = useMemo(() => posts.filter((p) => p.featured).length, [posts])
  const pendingNewsletterCount = useMemo(
    () => posts.filter((p) => p.status === 'published' && !sentIds.has(p.id)).length,
    [posts, sentIds]
  )

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

  // Any filter change can shrink the result set below the current page — snap back
  // to page 1 rather than showing an empty page that looks like "no results". Adjusted
  // during render (see the seriesEverActive comment above) instead of in an effect.
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
    <div className="min-h-screen p-4 sm:p-6 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-6 lg:space-y-8">
        <header className="bg-[color-mix(in_oklch,var(--background)_90%,var(--accent)_10%)] border border-[color-mix(in_oklch,var(--subtle)_45%,var(--accent)_20%)] p-5 sm:p-6 lg:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="kicker mb-2">Admin Console</p>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight">内容编排后台</h1>
              <p className="text-sm text-[var(--muted)] mt-3">管理专题结构与文章发布节奏。</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href="/dashboard"
                className="px-4 py-2 text-sm border border-[var(--subtle)] border-opacity-35 hover:border-[var(--foreground)] transition-colors"
              >
                控制台
              </a>
              <a
                href="/admin/upload"
                className="px-4 py-2 text-sm border border-[var(--subtle)] border-opacity-35 hover:border-[var(--foreground)] transition-colors"
              >
                上传图片
              </a>
              <a
                href="/admin/new"
                className="px-4 py-2 text-sm bg-[var(--foreground)] text-[var(--background)] hover:opacity-80 transition-opacity"
              >
                新建文章
              </a>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm border border-[var(--subtle)] border-opacity-35 hover:border-[var(--foreground)] transition-colors"
              >
                退出
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-6">
            <button
              onClick={() => { setActiveTab('posts'); resetFilters() }}
              className="bg-[var(--background)] border border-[var(--subtle)] border-opacity-30 px-4 py-3 text-left transition-colors hover:border-[var(--foreground)]"
            >
              <p className="kicker">文章总数</p>
              <p className="text-xl font-semibold mt-1">{posts.length}</p>
            </button>
            <button
              onClick={() => { setActiveTab('posts'); setQuery(''); setTypeFilter('all'); setStatusFilter('all'); setQuickFilter('pending') }}
              className="bg-[var(--background)] border border-[var(--subtle)] border-opacity-30 px-4 py-3 text-left transition-colors hover:border-[var(--foreground)]"
            >
              <p className="kicker">待发 Newsletter</p>
              <p className="text-xl font-semibold mt-1">{pendingNewsletterCount}</p>
            </button>
            <button
              onClick={() => { setActiveTab('posts'); setQuery(''); setTypeFilter('all'); setStatusFilter('all'); setQuickFilter('featured') }}
              className="bg-[var(--background)] border border-[var(--subtle)] border-opacity-30 px-4 py-3 text-left transition-colors hover:border-[var(--foreground)]"
            >
              <p className="kicker">精选</p>
              <p className="text-xl font-semibold mt-1">{featuredCount} / 3</p>
            </button>
          </div>
        </header>

        {/* Tab bar */}
        <div className="sticky top-0 z-10 bg-[var(--surface)] -mx-4 sm:-mx-6 lg:-mx-10 px-4 sm:px-6 lg:px-10 pt-2 pb-px border-b border-[var(--subtle)] border-opacity-25">
          <div className="max-w-7xl mx-auto flex items-center gap-8">
            <button
              onClick={() => setActiveTab('posts')}
              className={`py-3 text-sm tracking-tight transition-colors border-b-2 -mb-px ${
                activeTab === 'posts'
                  ? 'border-[var(--foreground)] text-[var(--foreground)] font-medium'
                  : 'border-transparent text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              文章管理
            </button>
            <button
              onClick={() => setActiveTab('series')}
              className={`py-3 text-sm tracking-tight transition-colors border-b-2 -mb-px ${
                activeTab === 'series'
                  ? 'border-[var(--foreground)] text-[var(--foreground)] font-medium'
                  : 'border-transparent text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              专题编排
            </button>
          </div>
        </div>

        {/* Series panel — mounted only after the tab has been opened at least once,
            then kept mounted (toggled via hidden) so its own state survives switching
            back to the posts tab. */}
        {seriesEverActive && (
          <div className={activeTab === 'series' ? '' : 'hidden'}>
            <SeriesManager />
          </div>
        )}

        <section className={`bg-[var(--background)] border border-[var(--subtle)] border-opacity-35 p-4 lg:p-6 ${activeTab === 'posts' ? '' : 'hidden'}`}>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <p className="kicker">Editorial Queue</p>
              <p className="text-2xl font-semibold tracking-tight mt-1">文章管理</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-xs border border-[var(--subtle)] border-opacity-35 disabled:opacity-40"
              >
                上一页
              </button>
              <span className="text-xs text-[var(--muted)]">
                第 {page} / {totalPages} 页
              </span>
              <button
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-xs border border-[var(--subtle)] border-opacity-35 disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索标题或 slug…"
              className="flex-1 min-w-[180px] border border-[var(--subtle)] border-opacity-30 bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)] transition"
            />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              className="border border-[var(--subtle)] border-opacity-30 bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)] transition"
            >
              <option value="all">全部类型</option>
              <option value="dive">深度</option>
              <option value="intel">情报</option>
              <option value="insight">洞见</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="border border-[var(--subtle)] border-opacity-30 bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--foreground)] transition"
            >
              <option value="all">全部状态</option>
              <option value="draft">草稿</option>
              <option value="published">发布</option>
            </select>
            {quickFilter !== 'all' && (
              <span className="flex items-center gap-2 px-3 py-2 text-xs kicker text-[var(--accent)] border border-[var(--accent)] border-opacity-40">
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

          <div className="hidden md:grid md:grid-cols-[110px_90px_1fr_70px_170px] px-2 pb-2 border-b border-[var(--subtle)] border-opacity-25 text-xs text-[var(--muted)]">
            <span>日期</span>
            <span>类型</span>
            <span>标题</span>
            <span>状态</span>
            <span className="text-right">操作</span>
          </div>

          {pagedPosts.length === 0 ? (
            <p className="py-8 text-sm text-[var(--muted)] text-center">没有匹配的文章。</p>
          ) : (
            <div className="divide-y divide-[var(--subtle)] divide-opacity-25">
              {pagedPosts.map((post) => {
                const busy = busySlug === post.slug
                return (
                  <div key={post.id} className="py-3 md:grid md:grid-cols-[110px_90px_1fr_70px_170px] md:items-center gap-3">
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
                        onClick={() => toggleFeatured(post.slug, post.featured, featuredCount, post.content_type)}
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
            <div className="mt-4 pt-3 border-t border-[var(--subtle)] border-opacity-25 flex items-center justify-between">
              <p className="text-xs text-[var(--muted)]">共 {filteredPosts.length} 篇，每页 {pageSize} 篇</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 text-xs border border-[var(--subtle)] border-opacity-35 disabled:opacity-40"
                >
                  上一页
                </button>
                <span className="text-xs text-[var(--muted)]">
                  {page}/{totalPages}
                </span>
                <button
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 text-xs border border-[var(--subtle)] border-opacity-35 disabled:opacity-40"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
