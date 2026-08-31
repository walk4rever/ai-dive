'use client'

import { useState, useRef } from 'react'

export function UploadClient() {
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<{ url: string; markdown: string }[]>([])
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    setError('')

    const uploaded: { url: string; markdown: string }[] = []

    for (const file of Array.from(files)) {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload', { method: 'POST', body: formData })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? '上传失败')
        break
      }

      uploaded.push({
        url: data.url,
        markdown: `![${file.name}](${data.url})`,
      })
    }

    setResults((prev) => [...uploaded, ...prev])
    setUploading(false)
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(text)
    setTimeout(() => setCopied(null), 2000)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    void handleFiles(e.dataTransfer.files)
  }

  const inputClass = 'w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm outline-none font-mono'

  return (
    <div className="max-w-2xl">
      <p className="font-serif text-2xl font-medium mb-8">图片上传</p>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] p-12 text-center cursor-pointer hover:border-[var(--ring)] transition-colors"
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <p className="text-sm text-[var(--muted)]">
          {uploading ? '上传中...' : '点击或拖拽图片到此处'}
        </p>
        <p className="mt-2 text-xs text-[var(--subtle)]">支持 JPG、PNG、GIF、WebP，最大 10 MB</p>
      </div>

      {error && <p className="mt-4 text-sm text-[var(--accent)]">{error}</p>}

      {results.length > 0 && (
        <div className="mt-8 space-y-4">
          {results.map((r) => (
            <div key={r.url} className="rounded-[var(--radius-lg)] border border-[var(--border)] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.url} alt="" className="w-full max-h-48 object-contain bg-[var(--subtle)] bg-opacity-10" />
              <div className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <input readOnly value={r.markdown} className={inputClass} onClick={(e) => (e.target as HTMLInputElement).select()} />
                  <button
                    onClick={() => void copy(r.markdown)}
                    className="shrink-0 kicker rounded-[var(--radius-md)] px-3 py-2 border border-[var(--border)] hover:border-[var(--ring)] transition-colors"
                  >
                    {copied === r.markdown ? '已复制' : '复制'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input readOnly value={r.url} className={inputClass} onClick={(e) => (e.target as HTMLInputElement).select()} />
                  <button
                    onClick={() => void copy(r.url)}
                    className="shrink-0 kicker rounded-[var(--radius-md)] px-3 py-2 border border-[var(--border)] hover:border-[var(--ring)] transition-colors"
                  >
                    {copied === r.url ? '已复制' : 'URL'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
