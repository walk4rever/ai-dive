'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ComponentPropsWithoutRef } from 'react'
import { useAgentChat, TOOL_META } from '@/hooks/useAgentChat'

const mdComponents = {
  a: (props: ComponentPropsWithoutRef<'a'>) => {
    const isExternal = /^https?:\/\//i.test(props.href ?? '')
    return <a {...props} target={isExternal ? '_blank' : undefined} rel={isExternal ? 'noopener noreferrer' : undefined} />
  },
}

const SUGGESTIONS = [
  '这篇文章的核心论点是什么？',
  '帮我解释一下里面提到的公式/推导',
  '这篇和 AI-DIVE 之前的内容有什么关联？',
]

interface QuoteButtonState {
  text: string
  top: number
  left: number
}

interface ArticleChatPanelProps {
  slug: string
  title: string
  children: ReactNode
}

// Desktop gets a docked two-column layout (article left, panel right); below
// that there's no room, so the panel stays a full-width overlay instead.
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  )

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return isDesktop
}

// Selections spanning a KaTeX-rendered formula grab mangled visual glyphs by
// default. Swap each .katex node for its MathML annotation (the original TeX
// source) before reading text, so quotes carry real formula source.
function extractSelectionText(range: Range): string {
  const container = document.createElement('div')
  container.appendChild(range.cloneContents())
  container.querySelectorAll('.katex').forEach((katexEl) => {
    const annotation = katexEl.querySelector('annotation[encoding="application/x-tex"]')
    if (annotation?.textContent) {
      katexEl.replaceWith(document.createTextNode(`$${annotation.textContent.trim()}$`))
    }
  })
  return container.textContent?.trim() ?? ''
}

export function ArticleChatPanel({ slug, title, children }: ArticleChatPanelProps) {
  const articleRef = useRef<HTMLDivElement>(null)
  const messageListRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const quoteButtonRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [quoteButton, setQuoteButton] = useState<QuoteButtonState | null>(null)
  const pendingArticleScrollRef = useRef<number | null>(null)
  const isDesktop = useIsDesktop()
  const docked = open && isDesktop

  const { messages, input, setInput, streaming, sendMessage, abort } = useAgentChat({
    sessionStorageKey: `ai_dive_article_chat:${slug}`,
    articleSlug: slug,
  })

  // Scroll only the message list itself, not scrollIntoView() — that walks up
  // and scrolls every ancestor scroll container needed to reveal the target,
  // including the (overflow: hidden) <body>/<html>, which are programmatically
  // scrollable even while locked. That reproduces the same "whole page jumps"
  // bug the scroll lock below is meant to prevent.
  useEffect(() => {
    if (!open) return
    const list = messageListRef.current
    if (!list) return
    requestAnimationFrame(() => {
      list.scrollTop = list.scrollHeight
    })
  }, [messages, open])

  // A quoted passage can be several lines — grow the box to show it instead
  // of clipping it inside a fixed 2-row textarea.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [input])

  // Once open, the article and the panel are each independently scrollable —
  // the page itself shouldn't also scroll (that's just leftover footer/padding
  // room showing a redundant window scrollbar).
  useEffect(() => {
    if (!open) return
    // The docked row is positioned assuming it starts at the top of the
    // viewport. If the page was already scrolled (e.g. the reader scrolled
    // down to select a passage before opening the panel), locking scroll at
    // that position leaves the row stuck mid-page with its top cut off.
    window.scrollTo(0, 0)
    // Replay the reading position captured in openPanel() as the article's
    // own scrollTop, now that it's an independent scroll box.
    if (pendingArticleScrollRef.current !== null && articleRef.current) {
      articleRef.current.scrollTop = pendingArticleScrollRef.current
    }
    pendingArticleScrollRef.current = null
    const prevBody = document.body.style.overflow
    const prevHtml = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevBody
      document.documentElement.style.overflow = prevHtml
    }
  }, [open])

  // Mirror of the capture above: once docked flips back to false, the
  // article reverts from its own scroll box to the window-scrolled
  // `mx-auto` layout, which starts the window back at scrollTop 0. Replay
  // the position saved in closePanel() before paint so closing the panel
  // doesn't snap the reader back to the top of the article.
  useLayoutEffect(() => {
    if (open) return
    if (pendingArticleScrollRef.current !== null) {
      window.scrollTo(0, pendingArticleScrollRef.current)
      pendingArticleScrollRef.current = null
    }
  }, [open])

  // Selection collapses natively on mousedown/mouseup as part of clicking the
  // quote button itself in some browsers, even with preventDefault on the
  // button. Tying "hide" to that same selectionchange event races the click:
  // the button can unmount before its onClick fires. So selectionchange only
  // ever shows/updates the button; dismissal is a separate outside-pointerdown
  // check against the button's own DOM node (the standard pattern for
  // selection-triggered toolbars).
  useEffect(() => {
    function handleSelectionChange() {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) return

      const range = selection.getRangeAt(0)
      if (!articleRef.current?.contains(range.commonAncestorContainer)) return

      const text = extractSelectionText(range)
      if (!text) return

      const rect = range.getBoundingClientRect()
      setQuoteButton({ text, top: rect.top - 40, left: rect.left + rect.width / 2 })
    }

    function handlePointerDown(e: PointerEvent) {
      if (quoteButtonRef.current && !quoteButtonRef.current.contains(e.target as Node)) {
        setQuoteButton(null)
      }
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [])

  // The article switches from window-scrolled (normal flow) to its own
  // scroll box the moment the panel docks — a brand new scroll context that
  // starts at scrollTop 0 regardless of how far the reader had scrolled.
  // Capture how far down they were before that switch so it can be replayed
  // as the new box's scrollTop, instead of the view snapping to the top.
  function openPanel() {
    pendingArticleScrollRef.current = articleRef.current
      ? Math.max(0, -articleRef.current.getBoundingClientRect().top)
      : null
    setOpen(true)
  }

  // The reverse of openPanel(): while docked, the article's reading position
  // lives in its own scroll box (articleRef.current.scrollTop), which the
  // window knows nothing about. Capture it before undocking so it can be
  // replayed onto the window in the effect above.
  function closePanel() {
    pendingArticleScrollRef.current = docked && articleRef.current ? articleRef.current.scrollTop : null
    setOpen(false)
  }

  function askAboutQuote() {
    if (!quoteButton) return
    const quoted = quoteButton.text.length > 400 ? quoteButton.text.slice(0, 400) + '…' : quoteButton.text
    setInput(`关于这段：「${quoted}」\n\n`)
    openPanel()
    setQuoteButton(null)
    window.getSelection()?.removeAllRanges()
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  return (
    <>
      <div className={docked ? 'flex items-start gap-10' : ''}>
        <div
          ref={articleRef}
          className={
            docked
              ? 'sticky top-6 h-[calc(100vh-9.5rem)] w-full max-w-2xl flex-shrink-0 overflow-y-auto overscroll-contain pr-6'
              : 'mx-auto max-w-2xl'
          }
        >
          {children}
        </div>

        {open && (
          <div
            className={
              docked
                ? 'sticky top-6 flex h-[calc(100vh-9.5rem)] w-[440px] flex-shrink-0 flex-col rounded-2xl'
                : 'fixed inset-y-0 right-0 z-40 flex w-full flex-col sm:w-[420px]'
            }
            style={{ background: 'var(--surface)', border: docked ? '1px solid var(--border)' : undefined, borderLeft: docked ? undefined : '1px solid var(--border)', boxShadow: docked ? '0 1px 4px rgba(20,20,19,0.05)' : '-8px 0 24px rgba(20,20,19,0.08)' }}
          >
            <div className="flex flex-shrink-0 items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="min-w-0">
                <p className="text-[0.7rem] font-medium uppercase tracking-[0.1em]" style={{ color: 'var(--accent)' }}>AI解读</p>
                <p className="truncate text-sm font-medium" style={{ color: '#141413' }}>{title}</p>
              </div>
              <button type="button" onClick={closePanel} aria-label="关闭" className="flex-shrink-0 text-xl leading-none" style={{ color: '#87867f' }}>
                ×
              </button>
            </div>

            <div ref={messageListRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5" style={{ scrollbarWidth: 'thin' }}>
              {messages.length === 0 ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm leading-relaxed" style={{ color: '#87867f' }}>
                    选中正文中的段落或公式，或者直接提问。
                  </p>
                  <div className="mt-2 flex flex-col gap-2">
                    {SUGGESTIONS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => sendMessage(q)}
                        className="rounded-[10px] px-3 py-2.5 text-left text-[0.83rem] leading-relaxed transition-colors"
                        style={{ background: '#faf9f5', border: '1px solid var(--border)', color: '#141413' }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {messages.map((msg, i) =>
                    msg.role === 'user' ? (
                      <div key={i} className="flex flex-row-reverse">
                        <p
                          className="max-w-[85%] whitespace-pre-wrap px-3.5 py-2 text-[0.83rem] leading-[1.8]"
                          style={{ background: 'var(--accent)', color: '#faf9f5', borderRadius: '12px 12px 3px 12px' }}
                        >
                          {msg.text}
                        </p>
                      </div>
                    ) : (
                      <div key={i} className="flex">
                        <div className="max-w-[95%]">
                          {(msg.toolCalls ?? []).length > 0 && (
                            <div className="mb-1.5 flex flex-col gap-1">
                              {(msg.toolCalls ?? []).map((tc, j) => (
                                <div
                                  key={j}
                                  className="flex w-fit items-center gap-1.5 rounded-[6px] px-2 py-1 text-xs transition-opacity"
                                  style={{ color: '#87867f', background: '#faf9f5', border: '1px solid var(--border)', opacity: tc.done ? 0.6 : 1 }}
                                >
                                  <span>{TOOL_META[tc.name]?.icon ?? '🔧'}</span>
                                  <span>{TOOL_META[tc.name]?.label ?? tc.name}</span>
                                  {!tc.done && <span style={{ opacity: 0.5 }}>…</span>}
                                </div>
                              ))}
                            </div>
                          )}
                          {(msg.text || (!msg.error && streaming && i === messages.length - 1)) && (
                            <div
                              className={msg.error ? 'text-red-600' : ''}
                              style={{ background: '#ffffff', border: '1px solid var(--border-subtle)', borderRadius: '3px 12px 12px 12px', padding: '0.55rem 0.85rem' }}
                            >
                              {msg.text ? (
                                streaming && i === messages.length - 1 ? (
                                  <p className="whitespace-pre-wrap text-[0.83rem] leading-[1.8]" style={{ color: '#141413' }}>{msg.text}</p>
                                ) : (
                                  <div className="agent-md">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{msg.text}</ReactMarkdown>
                                  </div>
                                )
                              ) : (
                                <p className="text-[0.83rem] leading-[1.8]" style={{ color: '#141413' }}>▋</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            <div className="flex-shrink-0 px-5 py-3.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  disabled={streaming}
                  rows={1}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      sendMessage(input)
                    }
                  }}
                  placeholder="针对这篇文章提问…（⌘Enter 发送）"
                  className="flex-1 resize-none overflow-y-auto rounded-[10px] px-3 py-2 text-[0.85rem] leading-relaxed outline-none"
                  style={{ minHeight: '36px', maxHeight: '160px', border: '1px solid var(--border)', background: '#ffffff', color: '#141413' }}
                />
                <button
                  type="button"
                  onClick={() => (streaming ? abort() : sendMessage(input))}
                  disabled={!streaming && !input.trim()}
                  className="flex-shrink-0 rounded-[10px] px-3 py-2 text-sm font-medium disabled:opacity-40"
                  style={{ background: streaming ? '#30302e' : 'var(--accent)', color: '#faf9f5' }}
                >
                  {streaming ? '停' : '发送'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {quoteButton && (
        <button
          ref={quoteButtonRef}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={askAboutQuote}
          className="fixed z-40 -translate-x-1/2 rounded-full px-3 py-1.5 text-xs font-medium shadow-lg transition-transform hover:scale-105"
          style={{ top: quoteButton.top, left: quoteButton.left, background: 'var(--accent)', color: '#faf9f5' }}
        >
          问 AI 这段 →
        </button>
      )}

      {!open && (
        <button
          type="button"
          onClick={openPanel}
          className="fixed bottom-6 right-6 z-30 rounded-full px-5 py-3 text-sm font-medium shadow-lg transition-transform hover:scale-105"
          style={{ background: 'var(--accent)', color: '#faf9f5' }}
        >
          AI解读
        </button>
      )}
    </>
  )
}
