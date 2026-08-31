'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MarkdownEditor } from '@/components/MarkdownEditor'

interface Post {
  slug: string
  title: string
  content: string
  body_markdown: string | null
  excerpt: string
  featured: boolean
  status: string
  published_at: string | null
  content_type: string
  author_slug: string | null
  author_display: string | null
}

export function EditForm({ post }: { post: Post }) {
  const router = useRouter()
  const [form, setForm] = useState({
    title: post.title,
    content: post.body_markdown ?? '',
    excerpt: post.excerpt ?? '',
    featured: post.featured,
    status: post.status,
    published_at: post.published_at ? post.published_at.slice(0, 10) : '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  function update<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const body: Record<string, unknown> = {
      title: form.title,
      excerpt: form.excerpt,
      featured: form.featured,
      status: form.status,
      published_at: form.published_at ? new Date(form.published_at).toISOString() : null,
    }
    if (form.content.trim() || post.body_markdown) body.content = form.content

    const res = await fetch(`/api/admin/posts/${post.slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      setSaved(true)
      router.refresh()
    } else {
      const data = await res.json()
      setError(data.error ?? '保存失败')
    }
    setSaving(false)
  }

  const inputClass = 'w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm outline-none focus:border-[var(--foreground)] transition'
  const labelClass = 'kicker mb-2 block'

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Metadata — all together, above the content editor */}
      <div className="space-y-6">
        <p className="text-xs text-[var(--muted)]">
          {post.content_type} · {post.author_slug} · {post.slug}
        </p>

        <div>
          <label className={labelClass}>标题</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            required
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>摘要</label>
          <textarea
            value={form.excerpt}
            onChange={(e) => update('excerpt', e.target.value)}
            rows={3}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>发布日期</label>
          <input
            type="date"
            value={form.published_at}
            onChange={(e) => update('published_at', e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="flex gap-8">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => update('featured', e.target.checked)}
            />
            <span className="kicker">精选</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.status === 'published'}
              onChange={(e) => update('status', e.target.checked ? 'published' : 'draft')}
            />
            <span className="kicker">已发布</span>
          </label>
        </div>
      </div>

      <div>
        <label className={labelClass}>正文 Markdown</label>
        <MarkdownEditor
          value={form.content}
          onChange={(content) => update('content', content)}
          legacyHtml={!post.body_markdown}
        />
      </div>

      {error && <p className="text-sm text-[var(--accent)]">{error}</p>}

      <div className="flex items-center gap-4 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-[var(--radius-md)] bg-[var(--foreground)] text-[var(--background)] px-6 py-2.5 text-sm hover:opacity-80 transition-opacity disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/posts')}
          className="rounded-[var(--radius-md)] border border-[var(--border)] px-6 py-2.5 text-sm text-[var(--foreground-soft)] transition-colors hover:border-[var(--ring)] hover:text-[var(--accent)]"
        >
          取消
        </button>
        {saved && <span className="text-sm text-[var(--muted)]">已保存</span>}
      </div>
    </form>
  )
}
