'use client'

import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ComponentPropsWithoutRef } from 'react'

const mdComponents = {
  a: (props: ComponentPropsWithoutRef<'a'>) => {
    const isExternal = /^https?:\/\//i.test(props.href ?? '')
    return <a {...props} target={isExternal ? '_blank' : undefined} rel={isExternal ? 'noopener noreferrer' : undefined} />
  },
}

interface ToolCall {
  id: string
  name: string
  detail?: string
  done: boolean
}

interface Message {
  role: 'user' | 'assistant'
  text: string
  toolCalls?: ToolCall[]
  error?: boolean
}

const TOOL_META: Record<string, { icon: string; label: string }> = {
  analyze_arxiv:   { icon: '📄', label: '读取论文' },
  analyze_github:  { icon: '📦', label: '读取仓库' },
  'search_ai_dive': { icon: '🔍', label: '搜索 AI-DIVE' },
}

function toolDetail(name: string, args: Record<string, unknown> | undefined): string | undefined {
  if (!args) return undefined
  const s = (k: string) => typeof args[k] === 'string' ? args[k] as string : undefined
  if (name === 'analyze_arxiv') return s('paper')
  if (name === 'analyze_github') return s('repo')
  if (name === 'search_ai_dive') return s('query')
  return s('query')
}

const SUGGESTIONS = [
  '帮我解读这篇论文的核心贡献，它和之前的工作有什么本质区别？',
  '分析这个 GitHub 项目的架构，它是怎么处理 context window 的？',
  'RAG 和 fine-tuning 分别适合哪种场景，判断依据是什么？',
  '这个客户案例里，他们的 agent 系统是怎么做 tool calling 的？',
]

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M8 2.5L13.5 8 8 13.5M2.5 8h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const StopIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
    <rect x="1" y="1" width="10" height="10" rx="1.5"/>
  </svg>
)

export function AgentChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const sessionIdRef = useRef('')

  useEffect(() => {
    const key = 'ai_dive_agent_session_id'
    let id = sessionStorage.getItem(key)
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem(key, id) }
    sessionIdRef.current = id
  }, [])

  function scrollToBottom() {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }))
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || streaming) return

    const assistantIndex = messages.length + 1
    setInput('')
    setMessages(prev => [
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
        body: JSON.stringify({ message: trimmed, userId: sessionIdRef.current }),
        signal: ctrl.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        setMessages(prev => prev.map((m, i) =>
          i === assistantIndex ? { ...m, text: err.error ?? '请求失败', error: true } : m
        ))
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
            try { data = JSON.parse(line.slice(5).trim()) } catch { continue }

            if (eventType === 'delta') {
              const delta = typeof data.text === 'string' ? data.text : ''
              setMessages(prev => prev.map((m, i) =>
                i === assistantIndex ? { ...m, text: m.text + delta } : m
              ))
              scrollToBottom()
            } else if (eventType === 'tool_start') {
              const id = typeof data.id === 'string' ? data.id : String(Date.now())
              const name = typeof data.name === 'string' ? data.name : 'tool'
              const detail = toolDetail(name, data.args as Record<string, unknown> | undefined)
              setMessages(prev => prev.map((m, i) =>
                i === assistantIndex
                  ? { ...m, toolCalls: [...(m.toolCalls ?? []), { id, name, detail, done: false }] }
                  : m
              ))
              scrollToBottom()
            } else if (eventType === 'tool_end') {
              const id = typeof data.id === 'string' ? data.id : ''
              setMessages(prev => prev.map((m, i) =>
                i === assistantIndex
                  ? { ...m, toolCalls: (m.toolCalls ?? []).map(tc => tc.id === id ? { ...tc, done: true } : tc) }
                  : m
              ))
            } else if (eventType === 'error') {
              const msg = typeof data.message === 'string' ? data.message : '未知错误'
              setMessages(prev => prev.map((m, i) =>
                i === assistantIndex ? { ...m, text: msg, error: true } : m
              ))
            }
            eventType = ''
          }
        }
      }
    } catch (err) {
      const aborted = (err as Error).name === 'AbortError'
      setMessages(prev => prev.map((m, i) =>
        i === assistantIndex
          ? { ...m, text: aborted ? '已中止' : ((err as Error).message || '连接失败'), error: !aborted || !m.text }
          : m
      ))
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Scroll area */}
      <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--border) transparent' }}>
        {messages.length === 0 ? (

          /* Empty state */
          <div className="flex flex-col items-center justify-center text-center min-h-full px-6 py-12 gap-3">
            <p className="text-[0.7rem] font-medium uppercase tracking-[0.1em]" style={{ color: 'var(--accent)' }}>
              Explore
            </p>
            <h1 className="font-serif text-[2rem] font-medium leading-[1.2]" style={{ color: '#141413', marginTop: '0.25rem' }}>
              深入任何一个 AI 技术话题。
            </h1>
            <p className="text-[0.9rem] leading-relaxed max-w-[420px]" style={{ color: '#87867f', marginTop: '0.1rem' }}>
              粘贴一篇 arxiv 论文、一个 GitHub 项目、或者直接描述你想搞懂的技术问题。
            </p>
            <div className="grid grid-cols-2 gap-2 w-full mt-5" style={{ maxWidth: '680px' }}>
              {SUGGESTIONS.map(q => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendMessage(q)}
                  className="text-left rounded-[10px] px-4 py-3 text-[0.83rem] leading-relaxed transition-all"
                  style={{
                    background: '#faf9f5',
                    border: '1px solid var(--border)',
                    color: '#141413',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--accent)'
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,100,66,0.07)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

        ) : (

          /* Messages */
          <div className="flex flex-col gap-6 mx-auto px-6 py-8" style={{ maxWidth: '860px' }}>
            {messages.map((msg, i) =>
              msg.role === 'user' ? (
                <div key={i} className="flex flex-row-reverse">
                  <div style={{ maxWidth: '80%' }}>
                    <p className="text-[0.84rem] leading-[1.85] px-4 py-2.5 whitespace-pre-wrap"
                      style={{
                        background: 'var(--accent)',
                        color: '#faf9f5',
                        borderRadius: '12px 12px 3px 12px',
                      }}>
                      {msg.text}
                    </p>
                  </div>
                </div>
              ) : (
                <div key={i} className="flex">
                  <div style={{ maxWidth: '80%' }}>
                    {(msg.toolCalls ?? []).length > 0 && (
                      <div className="flex flex-col gap-1 mb-2">
                        {(msg.toolCalls ?? []).map((tc, j) => (
                          <div
                            key={j}
                            className="flex items-center gap-1.5 text-xs rounded-[6px] px-2 py-1 w-fit transition-opacity"
                            style={{
                              color: '#87867f',
                              background: '#faf9f5',
                              border: '1px solid var(--border)',
                              opacity: tc.done ? 0.6 : 1,
                            }}
                          >
                            <span>{TOOL_META[tc.name]?.icon ?? '🔧'}</span>
                            <span>{TOOL_META[tc.name]?.label ?? tc.name}</span>
                            {tc.detail && (
                              <span className="italic" style={{ color: '#b0aea5' }}>
                                &ldquo;{tc.detail.length > 40 ? tc.detail.slice(0, 40) + '…' : tc.detail}&rdquo;
                              </span>
                            )}
                            {!tc.done && <span style={{ opacity: 0.5 }}>…</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {(msg.text || (!msg.error && streaming && i === messages.length - 1)) && (
                      <div
                        className={msg.error ? 'text-red-600' : ''}
                        style={{
                          background: '#ffffff',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '3px 12px 12px 12px',
                          boxShadow: '0 1px 4px rgba(20,20,19,0.05)',
                          padding: '0.6rem 1rem',
                        }}
                      >
                        {msg.text ? (
                          streaming && i === messages.length - 1 ? (
                            <p className="text-[0.84rem] leading-[1.85] whitespace-pre-wrap" style={{ color: '#141413' }}>
                              {msg.text}
                            </p>
                          ) : (
                            <div className="agent-md">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={mdComponents}
                              >
                                {msg.text}
                              </ReactMarkdown>
                            </div>
                          )
                        ) : (
                          <p className="text-[0.84rem] leading-[1.85]" style={{ color: '#141413' }}>▋</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            )}
            <div ref={bottomRef} />
          </div>

        )}
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 px-6 py-3.5" style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface)' }}>
        <div className="flex items-end gap-2 mx-auto" style={{ maxWidth: '860px' }}>
          <textarea
            value={input}
            disabled={streaming}
            rows={2}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                sendMessage(input)
              }
            }}
            placeholder="粘贴论文链接、GitHub URL，或直接描述技术问题… （⌘Enter 发送）"
            className="flex-1 resize-none outline-none text-[0.9rem] leading-relaxed transition-all"
            style={{
              height: '52px',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '0.65rem 0.9rem',
              background: '#ffffff',
              color: '#141413',
              boxShadow: '0 1px 3px rgba(20,20,19,0.04)',
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = 'var(--accent)'
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,100,66,0.1)'
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(20,20,19,0.04)'
            }}
          />
          <button
            type="button"
            onClick={() => { if (streaming) abortRef.current?.abort(); else sendMessage(input) }}
            disabled={!streaming && !input.trim()}
            className="flex-shrink-0 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: streaming ? '#30302e' : 'var(--accent)',
              color: '#faf9f5',
              marginBottom: '6px',
            }}
            aria-label={streaming ? '中止' : '发送'}
          >
            {streaming ? <StopIcon /> : <SendIcon />}
          </button>
        </div>
        <p className="text-center text-[0.72rem] mt-2 mx-auto" style={{ maxWidth: '860px', color: '#b0aea5' }}>
          AI-DIVE © 2026 · Powered by{' '}
          <a href="https://air7.fun" target="_blank" rel="noopener noreferrer"
            className="transition-colors hover:text-[var(--accent)]" style={{ color: '#87867f' }}>
            Air7.fun
          </a>
        </p>
      </div>
    </div>
  )
}
