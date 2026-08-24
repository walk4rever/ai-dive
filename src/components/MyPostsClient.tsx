'use client'

import { useState } from 'react'
import { getTypeLabel } from '@/lib/content'

export interface Post {
  id: string
  slug: string
  title: string
  content_type: string
  status: string
  featured: boolean
  published_at: string | null
}

function formatDate(value: string | null) {
  if (!value) return ''
  const d = new Date(value)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

interface MyPostsClientProps {
  initialPosts: Post[]
}

export function MyPostsClient({ initialPosts }: MyPostsClientProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts)

  async function deletePost(slug: string) {
    if (!confirm(`确认删除「${slug}」？此操作不可撤销。`)) return
    await fetch(`/api/my/posts/${slug}`, { method: 'DELETE' })
    setPosts((prev) => prev.filter((p) => p.slug !== slug))
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-baseline justify-between mb-10">
        <div>
          <p className="kicker mb-1">我的文章</p>
          <p className="text-sm text-[var(--muted)]">{posts.length} 篇</p>
        </div>
        <a href="/dashboard" className="kicker text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
          ← 控制台
        </a>
      </div>

      {posts.length === 0 ? (
        <p className="text-sm text-[var(--muted)] py-8">还没有文章，让你的 Agent 发布第一篇吧。</p>
      ) : (
        <div className="divide-y divide-[var(--border-subtle)]">
          {posts.map((post) => (
            <div key={post.id} className="py-4 flex items-center gap-4">
              <span className="date shrink-0 w-24">{formatDate(post.published_at)}</span>
              <span className="kicker shrink-0 w-12">{getTypeLabel(post.content_type)}</span>
              <div className="flex-1 min-w-0">
                <a
                  href={`/post/${post.slug}`}
                  target="_blank"
                  className="text-sm leading-snug hover:text-[var(--accent)] transition-colors"
                >
                  {post.title}
                </a>
              </div>
              {post.status === 'draft' && (
                <span className="kicker text-[var(--muted)] shrink-0">草稿</span>
              )}
              <div className="flex items-center gap-3 shrink-0">
                <a
                  href={`/my/posts/${post.slug}/edit`}
                  className="kicker text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  编辑
                </a>
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
      )}
    </div>
  )
}
