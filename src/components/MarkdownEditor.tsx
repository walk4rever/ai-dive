'use client'

import { useState } from 'react'
import { MermaidContent } from '@/components/MermaidContent'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  legacyHtml?: boolean
}

type Mode = 'edit' | 'preview'

export function MarkdownEditor({ value, onChange, disabled = false, legacyHtml = false }: MarkdownEditorProps) {
  const [mode, setMode] = useState<Mode>('edit')
  const [previewHtml, setPreviewHtml] = useState('')
  /** The content the current previewHtml was rendered from — lets switching back to
   *  "预览" reuse the last render instead of re-fetching when nothing changed. */
  const [previewedContent, setPreviewedContent] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [error, setError] = useState('')

  async function showPreview() {
    setMode('preview')
    if (previewedContent === value) return

    setPreviewing(true)
    setError('')
    const res = await fetch('/api/admin/posts/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: value }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      setError(data?.error ?? '预览失败')
    } else {
      setPreviewHtml(data.html ?? '')
      setPreviewedContent(value)
    }
    setPreviewing(false)
  }

  return (
    <div className="space-y-3">
      {legacyHtml && (
        <p className="text-xs text-[var(--muted)] border-l-2 border-[var(--accent)] pl-3">
          这篇文章没有保存 Markdown 源文件。保存前请将正文转换为 Markdown，旧正文不会自动填入编辑器。
        </p>
      )}

      <div className="inline-flex rounded-[var(--radius-md)] border border-[var(--border)] p-0.5">
        <button
          type="button"
          onClick={() => setMode('edit')}
          className={`rounded-[calc(var(--radius-md)-2px)] px-4 py-1.5 text-sm transition-colors ${
            mode === 'edit' ? 'bg-[var(--foreground)] text-[var(--background)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
          }`}
        >
          编辑
        </button>
        <button
          type="button"
          onClick={() => void showPreview()}
          disabled={!value.trim()}
          className={`rounded-[calc(var(--radius-md)-2px)] px-4 py-1.5 text-sm transition-colors disabled:opacity-40 ${
            mode === 'preview' ? 'bg-[var(--foreground)] text-[var(--background)]' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
          }`}
        >
          预览
        </button>
      </div>

      {mode === 'edit' ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          rows={24}
          className="w-full min-h-[32rem] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm leading-relaxed font-mono outline-none focus:border-[var(--foreground)] transition"
          placeholder="使用 Markdown 编写正文"
        />
      ) : (
        <div className="h-[32rem] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] p-6">
          {previewing ? (
            <p className="text-sm text-[var(--muted)]">生成预览中...</p>
          ) : error ? (
            <p className="text-sm text-[var(--accent)]">{error}</p>
          ) : (
            <MermaidContent className="prose" html={previewHtml} />
          )}
        </div>
      )}
    </div>
  )
}
