'use client'

import { useEffect, useRef, useState } from 'react'
import type { ArticleHeading } from '@/lib/extract-headings'
import { findScrollContainer } from '@/lib/scroll-container'

const MIN_HEADINGS_TO_SHOW = 3

function scrollHeadingIntoView(id: string) {
  const el = document.getElementById(id)
  if (!el) return

  const marginTop = parseFloat(getComputedStyle(el).scrollMarginTop) || 0
  const container = findScrollContainer(el)

  if (container) {
    const top = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - marginTop
    container.scrollTo({ top, behavior: 'smooth' })
    return
  }

  window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - marginTop, behavior: 'smooth' })
}

interface ArticleTocProps {
  headings: ArticleHeading[]
}

export function ArticleToc({ headings }: ArticleTocProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  if (headings.length < MIN_HEADINGS_TO_SHOW) return null

  function goTo(id: string) {
    scrollHeadingIntoView(id)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="fixed left-6 top-6 z-30">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="文章目录"
        aria-expanded={open}
        className="flex h-11 w-11 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <line x1="1" y1="3" x2="17" y2="3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="1" y1="9" x2="13" y2="9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="1" y1="15" x2="15" y2="15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <nav
          className="mt-2 max-h-[70vh] w-80 overflow-y-auto rounded-2xl p-4 shadow-xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          aria-label="文章目录"
        >
          <div className="mb-2.5 flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
            <p className="kicker" style={{ color: 'var(--accent)' }}>目录</p>
            <span className="text-[11px] text-[var(--subtle)] tracking-wider">
              {headings.length} 个小节
            </span>
          </div>
          <ul className="flex flex-col">
            {headings.map((heading, idx) => {
              const isH2 = heading.level === 2
              const isH3 = heading.level === 3
              const isH4 = heading.level === 4

              return (
                <li
                  key={heading.id}
                  className={isH2 && idx > 0 ? 'mt-2.5 pt-1.5 border-t border-[var(--border-subtle)]/70' : ''}
                >
                  <button
                    type="button"
                    onClick={() => goTo(heading.id)}
                    className={[
                      'group flex w-full text-left transition-all duration-150 py-1.5 px-2 rounded-r-md',
                      'hover:bg-[var(--surface-sand)]/50',
                      isH2 && 'text-sm font-medium text-[var(--foreground)] hover:text-[var(--accent)]',
                      isH3 && 'ml-2 text-[13px] text-[var(--muted)] border-l-2 border-[var(--border)] pl-2.5 hover:border-[var(--accent)] hover:text-[var(--accent)]',
                      isH4 && 'ml-5 text-xs text-[var(--subtle)] border-l-2 border-[var(--border-subtle)] pl-2.5 hover:border-[var(--accent)] hover:text-[var(--accent)]',
                    ].filter(Boolean).join(' ')}
                  >
                    <span className="leading-snug">{heading.text}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
      )}
    </div>
  )
}
