'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getTypeLabel } from '@/lib/content'

interface Series {
  id: string
  name: string
  description: string
  created_at: string
  updated_at: string
}

interface AdminPost {
  id: string
  slug: string
  title: string
  content_type: string
  status: string
  published_at: string | null
}

interface SeriesPost {
  post_id: string
  joined_at: string
  post: AdminPost
}

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('user_token') : null
}

function formatDate(value: string | null) {
  if (!value) return '未发布'
  const d = new Date(value)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export function SeriesManager() {
  const router = useRouter()
  const [seriesList, setSeriesList] = useState<Series[]>([])
  const [allPosts, setAllPosts] = useState<AdminPost[]>([])
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('')
  const [seriesPosts, setSeriesPosts] = useState<SeriesPost[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newSeriesName, setNewSeriesName] = useState('')
  const [newSeriesDescription, setNewSeriesDescription] = useState('')
  const [selectedPostId, setSelectedPostId] = useState('')

  const selectedSeries = useMemo(
    () => seriesList.find((item) => item.id === selectedSeriesId) ?? null,
    [seriesList, selectedSeriesId]
  )

  const fetchSeries = useCallback(async () => {
    const res = await fetch('/api/admin/series', {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    if (res.status === 401) { router.push('/login'); return }
    const data = await res.json()
    const list = (data.series ?? []) as Series[]
    setSeriesList(list)
    if (list.length > 0 && !selectedSeriesId) {
      setSelectedSeriesId(list[0].id)
    }
  }, [router, selectedSeriesId])

  const fetchPosts = useCallback(async () => {
    const res = await fetch('/api/admin/posts', {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    if (res.status === 401) { router.push('/login'); return }
    const data = await res.json()
    setAllPosts(data.posts ?? [])
  }, [router])

  const fetchSeriesPosts = useCallback(async (seriesId: string) => {
    if (!seriesId) {
      setSeriesPosts([])
      return
    }
    const res = await fetch(`/api/admin/series/${seriesId}/posts`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    if (res.status === 401) { router.push('/login'); return }
    const data = await res.json()
    setSeriesPosts((data.posts ?? []) as SeriesPost[])
  }, [router])

  useEffect(() => {
    const role = localStorage.getItem('user_role')
    if (!getToken() || role !== 'admin') { router.push('/login'); return }

    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true)
        await Promise.all([fetchSeries(), fetchPosts()])
        setLoading(false)
      })()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [fetchPosts, fetchSeries, router])

  useEffect(() => {
    if (!selectedSeriesId) return
    const timer = window.setTimeout(() => {
      void fetchSeriesPosts(selectedSeriesId)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [fetchSeriesPosts, selectedSeriesId])

  async function createSeries() {
    if (!newSeriesName.trim()) return
    setSaving(true)

    const res = await fetch('/api/admin/series', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({
        name: newSeriesName.trim(),
        description: newSeriesDescription.trim(),
      }),
    })

    const data = await res.json().catch(() => null)
    if (!res.ok) {
      alert(data?.error ?? '创建专题失败')
      setSaving(false)
      return
    }

    const created = data?.series as Series
    setSeriesList((prev) => [created, ...prev])
    setSelectedSeriesId(created.id)
    setNewSeriesName('')
    setNewSeriesDescription('')
    setSaving(false)
  }

  async function updateSeries() {
    if (!selectedSeries) return
    setSaving(true)

    const res = await fetch(`/api/admin/series/${selectedSeries.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({
        name: selectedSeries.name,
        description: selectedSeries.description,
      }),
    })

    const data = await res.json().catch(() => null)
    if (!res.ok) {
      alert(data?.error ?? '更新专题失败')
      setSaving(false)
      return
    }

    const updated = data?.series as Series
    setSeriesList((prev) => prev.map((item) => item.id === updated.id ? updated : item))
    setSaving(false)
  }

  async function deleteSeries() {
    if (!selectedSeries) return
    if (!confirm(`确认删除专题「${selectedSeries.name}」？`)) return

    setSaving(true)
    const res = await fetch(`/api/admin/series/${selectedSeries.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    })

    const data = await res.json().catch(() => null)
    if (!res.ok) {
      alert(data?.error ?? '删除专题失败')
      setSaving(false)
      return
    }

    const next = seriesList.filter((item) => item.id !== selectedSeries.id)
    setSeriesList(next)
    setSelectedSeriesId(next[0]?.id ?? '')
    setSeriesPosts([])
    setSaving(false)
  }

  async function addPostToSeries() {
    if (!selectedSeries || !selectedPostId) return
    setSaving(true)

    const res = await fetch(`/api/admin/series/${selectedSeries.id}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ post_id: selectedPostId }),
    })

    const data = await res.json().catch(() => null)
    if (!res.ok) {
      alert(data?.error ?? '加入专题失败')
      setSaving(false)
      return
    }

    await fetchSeriesPosts(selectedSeries.id)
    setSelectedPostId('')
    setSaving(false)
  }

  async function removeFromSeries(postId: string) {
    if (!selectedSeries) return

    const res = await fetch(`/api/admin/series/${selectedSeries.id}/posts/${postId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    })

    const data = await res.json().catch(() => null)
    if (!res.ok) {
      alert(data?.error ?? '移除失败')
      return
    }

    await fetchSeriesPosts(selectedSeries.id)
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)] p-8">加载中...</p>
  }

  const postOptions = allPosts.filter((post) => !seriesPosts.some((item) => item.post_id === post.id))

  return (
    <div className="bg-[color-mix(in_oklch,var(--background)_93%,var(--accent)_7%)] border border-[color-mix(in_oklch,var(--subtle)_45%,var(--accent)_15%)] p-6 lg:p-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker mb-2">Series Studio</p>
          <p className="text-2xl font-semibold tracking-tight">专题编排</p>
          <p className="text-sm text-[var(--muted)] mt-2">创建专题、关联文章、维护顺序。</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 text-xs border border-[var(--subtle)] border-opacity-40 bg-[var(--background)]">
            专题 {seriesList.length}
          </span>
          <span className="px-3 py-1.5 text-xs border border-[var(--subtle)] border-opacity-40 bg-[var(--background)]">
            已编排 {seriesPosts.length}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        <section className="bg-[var(--background)] border border-[var(--subtle)] border-opacity-35 p-4 space-y-4">
          <p className="kicker">新建专题</p>
          <input
            value={newSeriesName}
            onChange={(e) => setNewSeriesName(e.target.value)}
            placeholder="例如：Harness"
            className="w-full border border-[var(--subtle)] border-opacity-35 bg-[var(--background)] px-3 py-2.5 text-sm outline-none focus:border-[var(--foreground)] transition-colors"
          />
          <textarea
            value={newSeriesDescription}
            onChange={(e) => setNewSeriesDescription(e.target.value)}
            placeholder="一句话描述这个专题的主题（可选）"
            rows={3}
            className="w-full border border-[var(--subtle)] border-opacity-35 bg-[var(--background)] px-3 py-2.5 text-sm outline-none focus:border-[var(--foreground)] transition-colors"
          />
          <button
            onClick={createSeries}
            disabled={saving}
            className="w-full bg-[var(--foreground)] text-[var(--background)] px-4 py-2.5 text-sm disabled:opacity-50"
          >
            创建专题
          </button>

          <div className="pt-4 border-t border-[var(--subtle)] border-opacity-30 space-y-2">
            <p className="kicker">已有专题</p>
            <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
              {seriesList.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedSeriesId(item.id)}
                  className={`w-full text-left px-3 py-2.5 text-sm border transition-colors ${
                    selectedSeriesId === item.id
                      ? 'border-[var(--foreground)] bg-[color-mix(in_oklch,var(--foreground)_5%,var(--background)_95%)]'
                      : 'border-[var(--subtle)] border-opacity-35 hover:border-[var(--foreground)]'
                  }`}
                >
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-[var(--muted)] mt-1">{item.description || '无描述'}</p>
                </button>
              ))}
              {seriesList.length === 0 && <p className="text-xs text-[var(--muted)]">暂无专题</p>}
            </div>
          </div>
        </section>

        <section className="bg-[var(--background)] border border-[var(--subtle)] border-opacity-35 p-4">
          {!selectedSeries && (
            <p className="text-sm text-[var(--muted)]">先在左侧创建一个专题，或选择已有专题。</p>
          )}

          {selectedSeries && (
            <div className="space-y-6">
              <div className="pb-4 border-b border-[var(--subtle)] border-opacity-30">
                <p className="kicker mb-3">专题信息</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    value={selectedSeries.name}
                    onChange={(e) => setSeriesList((prev) => prev.map((item) => item.id === selectedSeries.id ? { ...item, name: e.target.value } : item))}
                    className="w-full border border-[var(--subtle)] border-opacity-35 bg-[var(--background)] px-3 py-2.5 text-sm outline-none focus:border-[var(--foreground)] transition-colors"
                  />
                  <textarea
                    value={selectedSeries.description}
                    onChange={(e) => setSeriesList((prev) => prev.map((item) => item.id === selectedSeries.id ? { ...item, description: e.target.value } : item))}
                    rows={2}
                    className="w-full border border-[var(--subtle)] border-opacity-35 bg-[var(--background)] px-3 py-2.5 text-sm outline-none focus:border-[var(--foreground)] transition-colors"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <button
                    onClick={updateSeries}
                    disabled={saving}
                    className="bg-[var(--foreground)] text-[var(--background)] px-4 py-2 text-sm disabled:opacity-50"
                  >
                    保存信息
                  </button>
                  <button
                    onClick={deleteSeries}
                    disabled={saving}
                    className="border border-red-500 text-red-500 px-4 py-2 text-sm disabled:opacity-50"
                  >
                    删除专题
                  </button>
                </div>
              </div>

              <div className="pb-4 border-b border-[var(--subtle)] border-opacity-30">
                <p className="kicker mb-3">加入文章</p>
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
                  <select
                    value={selectedPostId}
                    onChange={(e) => setSelectedPostId(e.target.value)}
                    className="w-full border border-[var(--subtle)] border-opacity-35 bg-[var(--background)] px-3 py-2.5 text-sm outline-none focus:border-[var(--foreground)] transition-colors"
                  >
                    <option value="">选择文章</option>
                    {postOptions.map((post) => (
                      <option key={post.id} value={post.id}>
                        {post.title}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={addPostToSeries}
                    disabled={saving || !selectedPostId}
                    className="bg-[var(--foreground)] text-[var(--background)] px-4 py-2.5 text-sm disabled:opacity-50"
                  >
                    加入专题
                  </button>
                </div>
              </div>

              <div>
                <p className="kicker mb-3">专题文章</p>
                <div className="divide-y divide-[var(--subtle)] divide-opacity-30">
                  {seriesPosts.map((item) => (
                    <div key={item.post_id} className="py-3 grid grid-cols-[1fr_auto] gap-3 items-center">
                      <div className="min-w-0">
                        <p className="text-sm leading-snug truncate">{item.post.title}</p>
                        <p className="text-xs text-[var(--muted)] mt-1">
                          {getTypeLabel(item.post.content_type)} · {item.post.slug} · {formatDate(item.post.published_at)}
                        </p>
                      </div>
                      <button
                        onClick={() => { void removeFromSeries(item.post_id) }}
                        className="kicker text-[var(--muted)] hover:text-red-500 transition-colors"
                      >
                        移除
                      </button>
                    </div>
                  ))}
                  {seriesPosts.length === 0 && (
                    <p className="text-sm text-[var(--muted)] py-2">当前专题还没有文章。</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
