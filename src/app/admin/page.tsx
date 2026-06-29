'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getTypeLabel } from '@/lib/content'
import { SeriesManager } from './SeriesManager'

type AdminTab = 'posts' | 'series'

interface Post {
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

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('user_token') : null
}

export default function AdminPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-[var(--muted)]">加载中...</p>
      </div>
    }>
      <AdminConsole />
    </Suspense>
  )
}

function AdminConsole() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const activeTab: AdminTab = tabParam === 'series' ? 'series' : 'posts'
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const pageSize = 50

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

  const fetchPosts = useCallback(async () => {
    const res = await fetch('/api/admin/posts', {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    if (res.status === 401) { router.push('/login'); return }
    const data = await res.json()
    const nextPosts = data.posts ?? []
    setPosts(nextPosts)
    setPage((prev) => {
      const totalPages = Math.max(1, Math.ceil(nextPosts.length / pageSize))
      return Math.min(prev, totalPages)
    })
    setLoading(false)
  }, [router])

  useEffect(() => {
    const role = localStorage.getItem('user_role')
    if (!getToken() || role !== 'admin') { router.push('/login'); return }
    const timer = window.setTimeout(() => {
      void fetchPosts()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [fetchPosts, router])

  async function toggleFeatured(slug: string, current: boolean, featuredCount: number, contentType: string) {
    if (!current && !['tech', 'case', 'insight'].includes(contentType)) {
      alert('只有技术、案例、洞见类型的文章可以设为精选。')
      return
    }
    if (!current && featuredCount >= 3) {
      alert('最多精选 3 篇，请先取消其他精选文章。')
      return
    }
    await fetch(`/api/admin/posts/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ featured: !current }),
    })
    await fetchPosts()
  }

  async function deletePost(slug: string) {
    if (!confirm(`确认删除「${slug}」？此操作不可撤销。`)) return
    await fetch(`/api/admin/posts/${slug}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    await fetchPosts()
  }

  function handleLogout() {
    localStorage.removeItem('user_token')
    localStorage.removeItem('user_email')
    localStorage.removeItem('user_role')
    router.push('/login')
  }

  const featuredCount = useMemo(() => posts.filter((p) => p.featured).length, [posts])
  const draftCount = useMemo(() => posts.filter((p) => p.status === 'draft').length, [posts])
  const totalPages = Math.max(1, Math.ceil(posts.length / pageSize))
  const pagedPosts = useMemo(() => {
    const start = (page - 1) * pageSize
    return posts.slice(start, start + pageSize)
  }, [page, posts])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-[var(--muted)]">加载中...</p>
      </div>
    )
  }

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
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm border border-[var(--subtle)] border-opacity-35 hover:border-[var(--foreground)] transition-colors"
              >
                退出
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-6">
            <div className="bg-[var(--background)] border border-[var(--subtle)] border-opacity-30 px-4 py-3">
              <p className="kicker">文章总数</p>
              <p className="text-xl font-semibold mt-1">{posts.length}</p>
            </div>
            <div className="bg-[var(--background)] border border-[var(--subtle)] border-opacity-30 px-4 py-3">
              <p className="kicker">草稿</p>
              <p className="text-xl font-semibold mt-1">{draftCount}</p>
            </div>
            <div className="bg-[var(--background)] border border-[var(--subtle)] border-opacity-30 px-4 py-3">
              <p className="kicker">精选</p>
              <p className="text-xl font-semibold mt-1">{featuredCount} / 3</p>
            </div>
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

        {/* Series panel (kept mounted, toggled via hidden to preserve state) */}
        <div className={activeTab === 'series' ? '' : 'hidden'}>
          <SeriesManager />
        </div>

        <section className={`bg-[var(--background)] border border-[var(--subtle)] border-opacity-35 p-4 lg:p-6 ${activeTab === 'posts' ? '' : 'hidden'}`}>
          <div className="flex items-center justify-between mb-4">
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

          <div className="hidden md:grid md:grid-cols-[110px_90px_1fr_70px_170px] px-2 pb-2 border-b border-[var(--subtle)] border-opacity-25 text-xs text-[var(--muted)]">
            <span>日期</span>
            <span>类型</span>
            <span>标题</span>
            <span>状态</span>
            <span className="text-right">操作</span>
          </div>

          <div className="divide-y divide-[var(--subtle)] divide-opacity-25">
            {pagedPosts.map((post) => (
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
                    className={`kicker transition-colors ${post.featured ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]'}`}
                  >
                    {post.featured ? '★ 精选' : '☆ 精选'}
                  </button>
                  <button
                    onClick={() => deletePost(post.slug)}
                    className="kicker text-[var(--muted)] hover:text-red-500 transition-colors"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
          {posts.length > pageSize && (
            <div className="mt-4 pt-3 border-t border-[var(--subtle)] border-opacity-25 flex items-center justify-between">
              <p className="text-xs text-[var(--muted)]">共 {posts.length} 篇，每页 {pageSize} 篇</p>
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
