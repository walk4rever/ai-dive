'use client'

import { useEffect, useRef, useState } from 'react'

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
}

export function useAgentChat({ sessionStorageKey, articleSlug }: UseAgentChatOptions) {
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const sessionIdRef = useRef('')

  useEffect(() => {
    let id = sessionStorage.getItem(sessionStorageKey)
    if (!id) {
      id = crypto.randomUUID()
      sessionStorage.setItem(sessionStorageKey, id)
    }
    sessionIdRef.current = id
  }, [sessionStorageKey])

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || streaming) return

    const assistantIndex = messages.length + 1
    setInput('')
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: trimmed },
      { role: 'assistant', text: '', toolCalls: [] },
    ])
    setStreaming(true)

    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, userId: sessionIdRef.current, articleSlug }),
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
    } catch (err) {
      const aborted = (err as Error).name === 'AbortError'
      setMessages((prev) =>
        prev.map((m, i) =>
          i === assistantIndex
            ? { ...m, text: aborted ? '已中止' : (err as Error).message || '连接失败', error: !aborted || !m.text }
            : m
        )
      )
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  function abort() {
    abortRef.current?.abort()
  }

  return { messages, input, setInput, streaming, sendMessage, abort }
}
