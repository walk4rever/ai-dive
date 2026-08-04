'use client'

import { useEffect, useEffectEvent, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { EditForm } from './EditForm'

interface Post {
  slug: string
  title: string
  content: string
  body_markdown: string | null
  excerpt: string
  featured: boolean
  status: string
  published_at: string | null
  is_premium: boolean
  content_type: string
  author_slug: string | null
  author_display: string | null
}

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('user_token') : null
}

export default function EditPage() {
  const router = useRouter()
  const params = useParams()
  const slug = params.slug as string
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchPost = useEffectEvent(async () => {
    const res = await fetch(`/api/admin/posts/${slug}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    if (res.status === 401) { router.push('/login'); return }
    if (res.status === 404) { router.push('/admin'); return }
    const data = await res.json()
    setPost(data.post)
    setLoading(false)
  })

  useEffect(() => {
    const role = localStorage.getItem('user_role')
    if (!getToken() || role !== 'admin') { router.push('/login'); return }
    void fetchPost()
  }, [router, slug])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-[var(--muted)]">加载中...</p>
      </div>
    )
  }

  if (!post) return null

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <a href="/admin" className="kicker text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
            ← 返回列表
          </a>
          <a href={`/post/${post.slug}`} target="_blank" className="kicker text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
            查看文章 →
          </a>
        </div>
        <p className="text-lg font-semibold mb-6">编辑文章</p>
        <EditForm post={post} />
      </div>
    </div>
  )
}
