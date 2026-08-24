'use client'

import { useState } from 'react'
import { MarkdownEditor } from '@/components/MarkdownEditor'

export interface EditablePost {
  slug: string
  title: string
  content: string
  body_markdown: string | null
  excerpt: string
  status: string
  published_at: string | null
  is_premium: boolean
  content_type: string
  author_slug: string | null
  author_display: string | null
}

const inputClass = 'w-full border border-[var(--subtle)] border-opacity-30 bg-[var(--background)] px-4 py-2.5 text-sm outline-none focus:border-[var(--foreground)] transition'
const labelClass = 'kicker mb-2 block'

interface MyPostEditClientProps {
  post: EditablePost
}

export function MyPostEditClient({ post }: MyPostEditClientProps) {
  const [form, setForm] = useState({
    title: post.title,
    excerpt: post.excerpt ?? '',
    content: post.body_markdown ?? '',
    status: post.status,
    published_at: post.published_at ? post.published_at.slice(0, 10) : '',
    is_premium: post.is_premium,
    author_display: post.author_display ?? post.author_slug ?? '',
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

    const res = await fetch(`/api/my/posts/${post.slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        excerpt: form.excerpt,
        content: form.content || undefined,
        status: form.status,
        published_at: form.published_at ? new Date(form.published_at).toISOString() : null,
        is_premium: form.is_premium,
        author_display: form.author_display || null,
      }),
    })

    if (res.ok) {
      setSaved(true)
    } else {
      const data = await res.json()
      setError(data.error ?? '保存失败')
    }
    setSaving(false)
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-8">
        <a href="/my/posts" className="kicker text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
          ← 我的文章
        </a>
        <a href={`/post/${post.slug}`} target="_blank" className="kicker text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
          查看文章 →
        </a>
      </div>

      <p className="text-lg font-semibold mb-6">编辑文章</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <p className="text-xs text-[var(--muted)]">{post.content_type} · {post.slug}</p>

        <div>
          <label className={labelClass}>标题</label>
          <input type="text" value={form.title} onChange={(e) => update('title', e.target.value)} required className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>正文 Markdown</label>
          <MarkdownEditor value={form.content} onChange={(content) => update('content', content)} legacyHtml={!post.body_markdown} />
        </div>

        <div>
          <label className={labelClass}>摘要</label>
          <textarea value={form.excerpt} onChange={(e) => update('excerpt', e.target.value)} rows={4} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>发布日期</label>
          <input type="date" value={form.published_at} onChange={(e) => update('published_at', e.target.value)} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>署名</label>
          <input type="text" value={form.author_display} onChange={(e) => update('author_display', e.target.value)} placeholder="例如 R129" className={inputClass} />
          <p className="mt-1 text-xs text-[var(--muted)]">可填入你的用户名以署名自己，或留空保持 Agent 署名</p>
        </div>

        <div className="flex gap-8">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_premium} onChange={(e) => update('is_premium', e.target.checked)} />
            <span className="kicker">付费</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.status === 'published'} onChange={(e) => update('status', e.target.checked ? 'published' : 'draft')} />
            <span className="kicker">已发布</span>
          </label>
        </div>

        {error && <p className="text-sm text-[var(--accent)]">{error}</p>}

        <div className="flex items-center gap-4 pt-2">
          <button type="submit" disabled={saving} className="bg-[var(--foreground)] text-[var(--background)] px-6 py-2.5 text-sm hover:opacity-80 transition-opacity disabled:opacity-50">
            {saving ? '保存中...' : '保存'}
          </button>
          {saved && <span className="text-sm text-[var(--muted)]">已保存</span>}
        </div>
      </form>
    </div>
  )
}
