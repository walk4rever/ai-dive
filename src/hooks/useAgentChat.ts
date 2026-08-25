'use client'

import { useEffect, useRef, useState } from 'react'
import { MAX_IMAGES_PER_MESSAGE, type ImageAttachment } from '@/lib/image-attachment'
import { deriveContextKey } from '@/lib/agent-context'

export type { ImageAttachment }

export interface ToolCall {
  id: string
  name: string
  detail?: string
  done: boolean
}

export interface AgentMessage {
  role: 'user' | 'assistant'
  text: string
  toolCalls?: ToolCall[]
  error?: boolean
  images?: ImageAttachment[]
  imageUrls?: string[]
}

export const TOOL_META: Record<string, { icon: string; label: string }> = {
  analyze_arxiv: { icon: '📄', label: '读取论文' },
  analyze_github: { icon: '📦', label: '读取仓库' },
  search_ai_dive: { icon: '🔍', label: '搜索 AI-DIVE' },
  get_article_content: { icon: '📰', label: '读取本文原文' },
}

export function toolDetail(name: string, args: Record<string, unknown> | undefined): string | undefined {
  if (!args) return undefined
  const s = (k: string) => (typeof args[k] === 'string' ? (args[k] as string) : undefined)
  if (name === 'analyze_arxiv') return s('paper')
  if (name === 'analyze_github') return s('repo')
  if (name === 'search_ai_dive') return s('query')
  if (name === 'get_article_content') return s('slug')
  return s('query')
}

interface UseAgentChatOptions {
  sessionStorageKey: string
  articleSlug?: string
  initialMessages?: AgentMessage[]
}

export function useAgentChat({ sessionStorageKey, articleSlug, initialMessages }: UseAgentChatOptions) {
  const [messages, setMessages] = useState<AgentMessage[]>(initialMessages ?? [])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [pendingImages, setPendingImages] = useState<ImageAttachment[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const pendingCancelRef = useRef<Promise<void> | null>(null)
  const sessionIdRef = useRef('')
  const contextKey = deriveContextKey(articleSlug)

  function addImage(image: ImageAttachment) {
    setPendingImages((prev) => (prev.length >= MAX_IMAGES_PER_MESSAGE ? prev : [...prev, image]))
  }

  function removeImage(index: number) {
    setPendingImages((prev) => prev.filter((_, i) => i !== index))
  }

  function persistTurn(role: 'user' | 'assistant', text: string, images?: ImageAttachment[]) {
    fetch('/api/agent-turns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contextKey, role, text, images }),
    }).catch(() => {
      // Best-effort — a dropped persist just means this turn won't reload after refresh.
    })
  }

  useEffect(() => {
    let id = sessionStorage.getItem(sessionStorageKey)
    if (!id) {
      id = crypto.randomUUID()
      sessionStorage.setItem(sessionStorageKey, id)
    }
    sessionIdRef.current = id
  }, [sessionStorageKey])

  useEffect(() => {
    // SSR-rendered pages seed history via `initialMessages` — this fetch is a
    // fallback for callers (e.g. the article chat panel) that don't.
    if (initialMessages) return

    let cancelled = false
    fetch(`/api/agent-turns?contextKey=${encodeURIComponent(contextKey)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { turns?: { role: 'user' | 'assistant'; text: string; imageUrls: string[] }[] } | null) => {
        if (cancelled || !data?.turns?.length) return
        const loaded: AgentMessage[] = data.turns.map((turn) => ({
          role: turn.role,
          text: turn.text,
          imageUrls: turn.imageUrls.length > 0 ? turn.imageUrls : undefined,
        }))
        // Only hydrate into an empty thread — never clobber a conversation the user
        // has already started while this request was in flight.
        setMessages((prev) => (prev.length === 0 ? loaded : prev))
      })
      .catch(() => {
        // Best-effort — history just won't be there for this thread.
      })

    return () => {
      cancelled = true
    }
    // initialMessages is only read to decide whether this mount already has
    // SSR-seeded history — it isn't meant to re-trigger the fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextKey])

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    const images = pendingImages
    if ((!trimmed && images.length === 0) || streaming) return

    const assistantIndex = messages.length + 1
    setInput('')
    setPendingImages([])
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: trimmed, images: images.length ? images : undefined },
      { role: 'assistant', text: '', toolCalls: [] },
    ])
    persistTurn('user', trimmed, images.length ? images : undefined)
    setStreaming(true)

    const ctrl = new AbortController()
    abortRef.current = ctrl
    // Accumulated outside React state (which updates asynchronously) so the persist
    // call below always sees the full streamed text, not a stale closure snapshot.
    let assistantText = ''

    try {
      // A stop click cancels the gateway session in the background so the UI can
      // stop instantly. Sending the next message before that cancel lands races
      // it — the gateway still sees the old generation and rejects this one as
      // "Session is busy" — so wait it out here rather than at click time.
      if (pendingCancelRef.current) {
        await pendingCancelRef.current
        pendingCancelRef.current = null
      }

      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          userId: sessionIdRef.current,
          articleSlug,
          images: images.length ? images : undefined,
        }),
        signal: ctrl.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        setMessages((prev) =>
          prev.map((m, i) => (i === assistantIndex ? { ...m, text: err.error ?? '请求失败', error: true } : m))
        )
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let eventType = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''

        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventType = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            let data: Record<string, unknown>
            try {
              data = JSON.parse(line.slice(5).trim())
            } catch {
              continue
            }

            if (eventType === 'delta') {
              const delta = typeof data.text === 'string' ? data.text : ''
              assistantText += delta
              setMessages((prev) => prev.map((m, i) => (i === assistantIndex ? { ...m, text: m.text + delta } : m)))
            } else if (eventType === 'tool_start') {
              const id = typeof data.id === 'string' ? data.id : String(Date.now())
              const name = typeof data.name === 'string' ? data.name : 'tool'
              const detail = toolDetail(name, data.args as Record<string, unknown> | undefined)
              setMessages((prev) =>
                prev.map((m, i) =>
                  i === assistantIndex
                    ? { ...m, toolCalls: [...(m.toolCalls ?? []), { id, name, detail, done: false }] }
                    : m
                )
              )
            } else if (eventType === 'tool_end') {
              const id = typeof data.id === 'string' ? data.id : ''
              setMessages((prev) =>
                prev.map((m, i) =>
                  i === assistantIndex
                    ? { ...m, toolCalls: (m.toolCalls ?? []).map((tc) => (tc.id === id ? { ...tc, done: true } : tc)) }
                    : m
                )
              )
            } else if (eventType === 'error') {
              const msg = typeof data.message === 'string' ? data.message : '未知错误'
              setMessages((prev) => prev.map((m, i) => (i === assistantIndex ? { ...m, text: msg, error: true } : m)))
            }
            eventType = ''
          }
        }
      }

      if (assistantText.trim()) persistTurn('assistant', assistantText)
    } catch (err) {
      const aborted = (err as Error).name === 'AbortError'
      setMessages((prev) =>
        prev.map((m, i) => {
          if (i !== assistantIndex) return m
          // Whatever streamed in before the abort is worth keeping on screen —
          // it's already what gets persisted below, so overwriting it with a bare
          // "已中止" just threw away a real (if incomplete) answer the user could
          // still read. Only fall back to the placeholder when nothing streamed.
          if (aborted) return m.text ? m : { ...m, text: '已中止', error: true }
          return { ...m, text: (err as Error).message || '连接失败', error: true }
        })
      )
      if (assistantText.trim()) persistTurn('assistant', assistantText)
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  function abort() {
    abortRef.current?.abort()
    // Closing our own fetch doesn't reach the gateway on every deployment target
    // (Vercel's Node.js serverless runtime never sees the browser disconnect at
    // all) — tell it directly so the session isn't left locked as busy. Kept
    // off the UI's critical path (the chat stops immediately either way), but
    // tracked so the next send can wait for it — see sendMessage.
    pendingCancelRef.current = fetch('/api/agent/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: sessionIdRef.current, articleSlug }),
    })
      .then(() => undefined)
      .catch(() => undefined)
  }

  return { messages, input, setInput, streaming, sendMessage, abort, pendingImages, addImage, removeImage }
}
