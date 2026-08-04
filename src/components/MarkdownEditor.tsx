'use client'

import { useState } from 'react'
import { MermaidContent } from '@/components/MermaidContent'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  legacyHtml?: boolean
}

export function MarkdownEditor({ value, onChange, disabled = false, legacyHtml = false }: MarkdownEditorProps) {
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewing, setPreviewing] = useState(false)
  const [error, setError] = useState('')

  async function preview() {
    setPreviewing(true)
    setError('')
    const token = localStorage.getItem('user_token')
    const res = await fetch('/api/admin/posts/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content: value }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) setError(data?.error ?? '预览失败')
    else setPreviewHtml(data.html ?? '')
    setPreviewing(false)
  }

  return (
    <div className="space-y-3">
      {legacyHtml && (
        <p className="text-xs text-[var(--muted)] border-l-2 border-[var(--accent)] pl-3">
          这篇文章没有保存 Markdown 源文件。保存前请将正文转换为 Markdown，旧正文不会自动填入编辑器。
        </p>
      )}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        rows={24}
        className="w-full min-h-[32rem] border border-[var(--subtle)] border-opacity-30 bg-[var(--background)] px-4 py-3 text-sm leading-relaxed font-mono outline-none focus:border-[var(--foreground)] transition"
        placeholder="使用 Markdown 编写正文"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void preview()}
          disabled={previewing || disabled || !value.trim()}
          className="border border-[var(--foreground)] px-4 py-2 text-sm hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors disabled:opacity-50"
        >
          {previewing ? '生成预览中...' : '预览正文'}
        </button>
        {error && <span className="text-sm text-[var(--accent)]">{error}</span>}
      </div>
      {previewHtml && (
        <div className="border border-[var(--border)] bg-[var(--background)] p-6">
          <p className="kicker mb-5">正文预览</p>
          <MermaidContent className="prose" html={previewHtml} />
        </div>
      )}
    </div>
  )
}
