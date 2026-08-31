'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'

interface NewsletterManagerProps {
  periodLabel: string
  signalCount: number
  postCount: number
  deckCount: number
  subscriberCount: number
  initialSummary: string
  alreadySentAt: string | null
  initialHtml: string
}

function formatDateTime(value: string) {
  const d = new Date(value)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function RefreshIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path
        d="M13.5 8A5.5 5.5 0 1 1 11.9 4.1M13.5 2v3h-3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path
        d="M8 2L9.2 5.8L13 7L9.2 8.2L8 12L6.8 8.2L3 7L6.8 5.8L8 2Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        fill="currentColor"
      />
      <path d="M13 2.5L13.5 4L15 4.5L13.5 5L13 6.5L12.5 5L11 4.5L12.5 4L13 2.5Z" fill="currentColor" />
    </svg>
  )
}

const inputClass = 'w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm outline-none focus:border-[var(--foreground)] transition'

export function NewsletterManager({
  periodLabel,
  signalCount,
  postCount,
  deckCount,
  subscriberCount,
  initialSummary,
  alreadySentAt,
  initialHtml,
}: NewsletterManagerProps) {
  const [summary, setSummary] = useState(initialSummary)
  const [html, setHtml] = useState(initialHtml)
  const [refreshing, setRefreshing] = useState(false)

  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')

  const [testEmail, setTestEmail] = useState('')
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle')
  const [testMsg, setTestMsg] = useState('')

  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState('')
  const [sendError, setSendError] = useState('')

  async function refreshPreviewWith(text: string) {
    setRefreshing(true)
    const res = await fetch('/api/admin/newsletter/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: text }),
    })
    const data = await res.json().catch(() => null)
    if (res.ok && data?.html) setHtml(data.html)
    setRefreshing(false)
  }

  async function handleGenerateSummary() {
    if (summary.trim() && !confirm('已有摘要内容，AI 生成会覆盖当前文字，确定继续？')) return

    setGenerating(true)
    setGenerateError('')

    const res = await fetch('/api/admin/newsletter/generate-summary', { method: 'POST' })
    const data = await res.json().catch(() => null)

    if (!res.ok) {
      setGenerateError(data?.error ?? '生成失败')
      setGenerating(false)
      return
    }

    setSummary(data.summary)
    await refreshPreviewWith(data.summary)
    setGenerating(false)
  }

  async function handleTestSend(e: React.FormEvent) {
    e.preventDefault()
    if (!summary.trim()) {
      setTestStatus('error')
      setTestMsg('先写一段信号解读摘要再发送')
      return
    }
    setTestStatus('loading')
    setTestMsg('')

    const res = await fetch('/api/admin/newsletter/test-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: testEmail, summary }),
    })
    const data = await res.json().catch(() => null)

    if (res.ok) {
      setTestStatus('success')
      setTestMsg(`已发送测试邮件到 ${testEmail}`)
    } else {
      setTestStatus('error')
      setTestMsg(data?.error ?? '发送失败')
    }
  }

  async function handleSendAll() {
    if (!summary.trim()) {
      setSendError('先写一段信号解读摘要再发送')
      return
    }
    if (!confirm(`确认发送给全部 ${subscriberCount} 位已确认订阅者？此操作不可撤销。`)) return

    setSending(true)
    setSendError('')
    setSendResult('')

    const res = await fetch('/api/admin/newsletter/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary }),
    })
    const data = await res.json().catch(() => null)

    if (!res.ok) {
      setSendError(data?.error ?? '发送失败')
      setSending(false)
      return
    }

    setSendResult(`已发送 ${data.sent} 封，跳过 ${data.skipped} 封，失败 ${data.failed} 封`)
    if (data.failures?.length) setSendError(data.failures.join('\n'))
    setSending(false)
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
          <div>
            <p className="kicker">Newsletter</p>
            <p className="font-serif text-2xl font-medium tracking-tight mt-1">周刊发送</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{periodLabel} · 信号解读 {signalCount} 条 · 深度阅读 {postCount} 篇 · 热门出品 {deckCount} 个 · 订阅者 {subscriberCount} 人</p>
          </div>
        </div>

        {alreadySentAt && (
          <p className="mb-4 rounded-[var(--radius-md)] border border-[var(--accent)] px-3.5 py-2.5 text-xs text-[var(--accent)]">
            本期已于 {formatDateTime(alreadySentAt)} 发送过。再次点击&ldquo;发送给全部订阅者&rdquo;只会补发给还没收到的人，不会重复打扰已经收到的订阅者。
          </p>
        )}

        <div className="flex items-center justify-between mb-2">
          <label className="kicker">信号解读摘要</label>
          <button
            type="button"
            onClick={handleGenerateSummary}
            disabled={generating}
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--background)] disabled:opacity-50"
          >
            <SparkleIcon />
            {generating ? 'AI 生成中...' : 'AI 生成'}
          </button>
        </div>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={7}
          placeholder="写一段本周信号的总体解读，会出现在「信号解读」栏目正文里，建议不超过 300 字、分 2-3 段（段落间空一行）……或点右上角「AI 生成」，把上周已评分的信号交给模型总结。"
          className={inputClass}
        />
        {generateError && <p className="mt-2 text-sm text-[var(--accent)]">{generateError}</p>}
      </Card>

      <Card
        kicker="预览"
        aside={
          <button
            type="button"
            onClick={() => refreshPreviewWith(summary)}
            disabled={refreshing}
            title="刷新预览"
            aria-label="刷新预览"
            className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] text-[var(--muted)] transition-colors hover:bg-[var(--border-subtle)] hover:text-[var(--foreground)] disabled:opacity-50"
          >
            <RefreshIcon />
          </button>
        }
      >
        <div className="mt-3 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)]">
          <iframe
            title="周刊预览"
            srcDoc={html}
            className="w-full"
            style={{ height: '900px', border: 'none' }}
          />
        </div>
      </Card>

      <Card kicker="发送测试">
        <form onSubmit={handleTestSend} className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="email"
            required
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="test@example.com"
            className={`${inputClass} flex-1 min-w-[220px]`}
          />
          <button
            type="submit"
            disabled={testStatus === 'loading'}
            className="rounded-[var(--radius-md)] border border-[var(--foreground)] px-5 py-2.5 text-sm transition-colors hover:bg-[var(--foreground)] hover:text-[var(--background)] disabled:opacity-50"
          >
            {testStatus === 'loading' ? '发送中...' : '发送测试'}
          </button>
        </form>
        {testMsg && (
          <p className={`mt-3 text-sm ${testStatus === 'success' ? 'text-[var(--muted)]' : 'text-[var(--accent)]'}`}>{testMsg}</p>
        )}
      </Card>

      <Card kicker="正式发送">
        <p className="mt-3 mb-4 text-sm text-[var(--muted)]">
          发送给全部 {subscriberCount} 位已确认订阅者，已经收到本期的人会被自动跳过。
        </p>
        <button
          type="button"
          onClick={handleSendAll}
          disabled={sending}
          className="rounded-[var(--radius-md)] bg-[var(--foreground)] px-6 py-2.5 text-sm font-medium text-[var(--background)] transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          {sending ? '发送中...' : `发送给全部订阅者`}
        </button>
        {sendResult && <p className="mt-3 text-sm text-[var(--muted)]">{sendResult}</p>}
        {sendError && <p className="mt-3 whitespace-pre-line text-sm text-[var(--accent)]">{sendError}</p>}
      </Card>
    </div>
  )
}
