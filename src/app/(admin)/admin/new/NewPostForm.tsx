'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MarkdownEditor } from '@/components/MarkdownEditor'

export function NewPostForm() {
  const router = useRouter()
  const [form, setForm] = useState({ slug: '', title: '', content: '', excerpt: '', content_type: 'dive', status: 'draft', published_at: '', author_display: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, published_at: form.published_at ? new Date(form.published_at).toISOString() : undefined }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      setError(data?.error ?? '保存失败')
      setSaving(false)
      return
    }
    router.push(`/admin/edit/${data.slug}`)
  }

  const inputClass = 'w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm outline-none focus:border-[var(--foreground)] transition'
  const labelClass = 'kicker mb-2 block'

  return (
    <div className="max-w-3xl">
      <a href="/admin/posts" className="kicker text-[var(--muted)] hover:text-[var(--foreground)]">← 返回列表</a>
      <h1 className="font-serif text-2xl font-medium mt-8 mb-8">新建文章</h1>
      <form onSubmit={submit} className="space-y-8">
        {/* Metadata — all together, above the content editor */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><label className={labelClass}>Slug</label><input required pattern="[a-z0-9-]+" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className={inputClass} /></div>
            <div><label className={labelClass}>标题</label><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} /></div>
            <div><label className={labelClass}>类型</label><select value={form.content_type} onChange={(e) => setForm({ ...form, content_type: e.target.value })} className={inputClass}><option value="dive">深度</option><option value="insight">洞见</option><option value="intel">情报</option></select></div>
            <div><label className={labelClass}>署名</label><input value={form.author_display} onChange={(e) => setForm({ ...form, author_display: e.target.value })} className={inputClass} placeholder="例如 R129" /></div>
            <div><label className={labelClass}>发布日期</label><input type="date" value={form.published_at} onChange={(e) => setForm({ ...form, published_at: e.target.value })} className={inputClass} /></div>
          </div>
          <div><label className={labelClass}>摘要</label><textarea rows={3} value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} className={inputClass} /></div>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.status === 'published'} onChange={(e) => setForm({ ...form, status: e.target.checked ? 'published' : 'draft' })} /><span className="kicker">立即发布</span></label>
        </div>

        <div><label className={labelClass}>正文 Markdown</label><MarkdownEditor value={form.content} onChange={(content) => setForm({ ...form, content })} /></div>

        {error && <p className="text-sm text-[var(--accent)]">{error}</p>}
        <div className="flex items-center gap-4">
          <button type="submit" disabled={saving} className="rounded-[var(--radius-md)] bg-[var(--foreground)] text-[var(--background)] px-6 py-2.5 text-sm disabled:opacity-50">{saving ? '保存中...' : '创建文章'}</button>
          <button
            type="button"
            onClick={() => router.push('/admin/posts')}
            className="rounded-[var(--radius-md)] border border-[var(--border)] px-6 py-2.5 text-sm text-[var(--foreground-soft)] transition-colors hover:border-[var(--ring)] hover:text-[var(--accent)]"
          >
            取消
          </button>
        </div>
      </form>
    </div>
  )
}
